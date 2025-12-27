// Módulo de integración con Anki para Noticing Game
window.AnkiIntegration = (function () {
    // Configuración por defecto
    const ANKI_URL = "http://127.0.0.1:8765";
    const ANKI_VERSION = 6;

    // Función genérica para llamar a la API de Anki
    // Ahora usa el proxy del background script
    function invoke(action, params = {}) {
        return new Promise((resolve, reject) => {
            if (!chrome || !chrome.runtime) {
                reject(new Error("Extension context invalid"));
                return;
            }

            chrome.runtime.sendMessage(
                {
                    action: "ankiConnect",
                    ankiAction: action,
                    params: params,
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }

                    if (response && response.success) {
                        if (response.data.error) {
                            reject(new Error(response.data.error));
                        } else {
                            resolve(response.data.result);
                        }
                    } else {
                        reject(new Error(response ? response.error : "Unknown error"));
                    }
                }
            );
        });
    }

    // Obtener lista de mazos
    function getDecks() {
        return invoke("deckNames");
    }

    // Obtener notas de un mazo
    function getNotesFromDeck(deckName) {
        return invoke("findNotes", { query: `deck:"${deckName}"` });
    }

    // Obtener info de notas
    function getNotesInfo(noteIds) {
        return invoke("notesInfo", { notes: noteIds });
    }

    // Flujo completo para importar palabras de un mazo
    // Devuelve una promesa que resuelve con un objeto { words: [], stats: [] }
    // options: { importStats: boolean, onlyLearned: boolean }
    async function importWordsFromDeck(deckName, options = {}) {
        try {
            // Construir query
            // Si solo aprendidas: 'deck:"..." (is:review OR is:learn)' - excluye 'is:new'
            let query = `deck:"${deckName}"`;
            if (options.onlyLearned) {
                query += ` -is:new`;
            }

            // 1. Obtener IDs de CARTAS (no notas) para tener acceso a estadísticas
            const cardIds = await invoke("findCards", { query: query });
            if (!cardIds || cardIds.length === 0) {
                throw new Error(`No cards found in deck "${deckName}" matching criteria`);
            }

            console.log(`Anki: Found ${cardIds.length} cards`);

            // 2. Obtener info de cartas (intervalo, facilidad) Y el noteId asociado
            const batchSize = 100;
            let allCardsInfo = [];

            for (let i = 0; i < cardIds.length; i += batchSize) {
                const batch = cardIds.slice(i, i + batchSize);
                const info = await invoke("cardsInfo", { cards: batch });
                allCardsInfo = allCardsInfo.concat(info);
            }

            // 3. Obtener Note IDs únicos
            const noteIds = [...new Set(allCardsInfo.map(c => c.note))];

            // 4. Obtener contenido de Notas (campos)
            let allNotesInfo = [];
            for (let i = 0; i < noteIds.length; i += batchSize) {
                const batch = noteIds.slice(i, i + batchSize);
                const info = await invoke("notesInfo", { notes: batch });
                allNotesInfo = allNotesInfo.concat(info);
            }

            const noteMap = {};
            allNotesInfo.forEach(n => noteMap[n.noteId] = n);

            const uniqueWords = new Set();
            const wordsList = [];
            const statsList = [];
            const duplicatesList = [];

            // Procesar cada carta para ver su dificultad y su palabra asociada
            allCardsInfo.forEach(card => {
                const note = noteMap[card.note];
                if (!note || !note.fields) return;

                // --- Extracción de Palabra Mejorada ---
                // Estrategia: Recolectar candidatos de campos prioritarios y resolver conflictos (espacios vs sin espacios)
                const keys = Object.keys(note.fields);
                const priorityFields = ['front', 'anverso', 'word', 'palabra', 'expression', 'term', 'question', 'pregunta', 'infinitive', 'vocab', 'vocabulary', 'verbo', 'verb', 'noun', 'sustantivo', 'adjetivo', 'adjective'];

                let candidates = [];

                // 1. Buscar en campos prioritarios
                for (const field of priorityFields) {
                    const matchingKey = keys.find(k => k.toLowerCase() === field);
                    if (matchingKey && note.fields[matchingKey]) {
                        const val = note.fields[matchingKey].value;
                        if (val && isNaN(Number(val.trim()))) {
                            candidates.push(val);
                        }
                    }
                }

                // 2. Si no hay candidatos prioritarios, buscar en todos los campos no numéricos
                // Excluyendo campos que parecen nombres de archivo o IDs si es posible
                if (candidates.length === 0) {
                    for (const key of keys) {
                        const val = note.fields[key].value;
                        const keyLow = key.toLowerCase();
                        // Ignorar campos 'audio', 'sound', 'image', 'archivo', 'filename', 'id'
                        if (keyLow.includes('audio') || keyLow.includes('sound') || keyLow.includes('pro nunciation') || keyLow.includes('filename') || keyLow.includes('archivo') || keyLow === 'id') {
                            continue;
                        }

                        if (val && isNaN(Number(val.trim()))) {
                            candidates.push(val);
                        }
                    }
                }

                // Limpiar candidatos (HTML, espacios)
                let cleanedCandidates = candidates.map(c => {
                    let clean = c
                        .replace(/<(div|p|br|li|tr)[^>]*>/gi, ' $&')
                        .replace(/<[^>]*>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .trim();
                    return clean;
                }).filter(c => c.length > 0);

                // Resolver conflicto: Preferir "go through" sobre "gothrough"
                // Si tenemos candidatos múltiples, ver si uno es la versión con espacios de otro
                let finalWord = "";

                if (cleanedCandidates.length === 1) {
                    finalWord = cleanedCandidates[0];
                } else if (cleanedCandidates.length > 1) {
                    // Ordenar por longitud (descendente) para favorecer frases completas o palabras con espacios?
                    // O Chequear pares específicos

                    // Buscar si existe un par (A, B) tal que A.replace(' ', '') === B
                    let bestCandidate = cleanedCandidates[0];

                    // Iterar para encontrar el "mas espaciado" que sea igual a los otros
                    // Ejemplo: ["gothrough", "go through"]
                    // "go through" cleans to "gothrough".

                    // Ordenamos tal que las que tienen espacios vayan primero si son "equivalentes"
                    cleanedCandidates.sort((a, b) => {
                        const aHasSpace = a.includes(' ');
                        const bHasSpace = b.includes(' ');
                        if (aHasSpace && !bHasSpace && a.replace(/\s/g, '') === b.replace(/\s/g, '')) return -1;
                        if (bHasSpace && !aHasSpace && b.replace(/\s/g, '') === a.replace(/\s/g, '')) return 1;
                        return 0;
                    });

                    finalWord = cleanedCandidates[0];
                }

                if (finalWord) {
                    const lowerWord = finalWord.toLowerCase();

                    if (uniqueWords.has(lowerWord)) {
                        duplicatesList.push(finalWord);
                    } else {
                        uniqueWords.add(lowerWord);
                        wordsList.push(finalWord);

                        // --- Cálculo de Dificultad ---
                        if (options.importStats) {
                            const interval = card.interval || 0;
                            let score = 10 - Math.log2(interval + 1);
                            score = Math.max(1, Math.min(10, score));

                            statsList.push({
                                word: finalWord,
                                difficultyScore: score
                            });
                        }
                    }
                }
            });

            return {
                words: wordsList,
                stats: statsList,
                duplicates: duplicatesList
            };
        } catch (error) {
            console.error("Error importing from Anki:", error);
            throw error;
        }
    }

    return {
        getDecks,
        importWordsFromDeck
    };
})();
