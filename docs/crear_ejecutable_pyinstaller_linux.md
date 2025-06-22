# Crear Ejecutable del Servidor Noticing Game en Linux

## 1. Preparación del Entorno

### 1.1 Ubicación del Proyecto
Abrir la terminal en la raíz del proyecto backend:
```bash
cd /ruta/al/proyecto/noticing_game/backend
```

### 1.2 Entorno Virtual
Verificar estar en el entorno virtual correcto (si se usa uno):
```bash
# Crear entorno virtual (si no existe)
python -m venv venv

# Activar entorno virtual
source venv/bin/activate
```

### 1.3 Dependencias
Instalar todas las dependencias necesarias:
```bash
# Actualizar pip
pip install --upgrade pip

# Instalar herramientas y dependencias
pip install pyinstaller
pip install -r requirements.txt
pip install pystray Pillow
pip install tkinter

# En sistemas Ubuntu/Debian, si falta tkinter:
sudo apt-get install python3-tk
```

## 2. Método Recomendado: Script Automático

### 2.1 Usar el Script de Construcción
```bash
# Construir ejecutable automáticamente
python build_executable_linux.py

# Con opciones adicionales
python build_executable_linux.py --clean --test

# Para depuración
python build_executable_linux.py --debug

# Para bundle de directorio (más rápido)
python build_executable_linux.py --onedir
```

## 3. Método Manual: Configurar el Archivo Spec

### 3.1 Crear Spec Inicial
```bash
pyi-makespec --onefile --windowed --add-data "subtitle_server.py:." desktop_app.py
```

### 3.2 Editar Archivo Spec
El archivo `desktop_app.spec` ya está configurado correctamente. Si necesitas recrearlo manualmente:

```python
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['desktop_app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('subtitle_server.py', '.'),
        ('requirements.txt', '.'),
        ('README.md', '.')
    ],
    hiddenimports=[
        'flask',
        'flask_cors',
        'yt_dlp',
        'requests',
        'tkinter',
        'tkinter.ttk',
        'tkinter.scrolledtext',
        'PIL',
        'PIL.Image',
        'PIL.ImageDraw',
        'pystray',
        'tempfile',
        'logging',
        'datetime',
        're',
        'json',
        'xml.etree.ElementTree',
        'urllib.request',
        'urllib.error',
        'webbrowser',
        'subtitle_server',
        'xml.parsers.expat',
        'email.mime.multipart',
        'email.mime.text',
        'threading',
        'socket',
        'subprocess'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='noticing_game_server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

## 4. Crear el Ejecutable (Método Manual)

### 4.1 Generar Ejecutable
```bash
pyinstaller desktop_app.spec
```

### 4.2 Permisos de Ejecución
```bash
chmod +x dist/noticing_game_server
```

## 5. Verificación y Pruebas

### 5.1 Ejecutar el Programa
```bash
./dist/noticing_game_server
```

### 5.2 Verificar Funcionalidades
- La interfaz gráfica debe abrirse
- El servidor debe iniciar correctamente (sin abrir otra ventana)
- El system tray debe estar disponible
- La extracción de subtítulos debe funcionar
- El servidor debe ejecutarse en el mismo proceso (modo embebido)

### 5.3 Solución a Problemas Comunes
Si al hacer clic en "Start Server" se abre otra ventana igual:
1. Asegúrate de usar el código actualizado de `desktop_app.py`
- Reconstruye el ejecutable con `python build_executable_linux.py --clean`
3. El nuevo código detecta automáticamente si está ejecutándose como ejecutable

## 6. Requisitos del Sistema

### 5.1 Software Necesario
- Python 3.8 o superior
- Tkinter para la interfaz gráfica
- Acceso a Internet

### 5.2 Permisos Requeridos
- Acceso a red (puerto 5000)
- Permisos de escritura en /tmp
- Permisos en el directorio home del usuario

## 7. Solución de Problemas

### 6.1 Interfaz Gráfica
Si la interfaz no abre:
```bash
# Verificar instalación de tkinter
python -c "import tkinter; tkinter._test()"

# Instalar tkinter si falta
sudo apt-get install python3-tk  # Ubuntu/Debian
sudo dnf install python3-tkinter # Fedora
sudo pacman -S tk               # Arch Linux
```

### 6.2 Servidor
Si el servidor no inicia:
- Verificar puerto 5000 disponible
- Revisar logs en ~/.noticing_game_logs/desktop_app.log
- Comprobar permisos de red

### 7.3 System Tray
Si hay problemas con el system tray:
- Verificar soporte en el entorno de escritorio
- Instalar dependencias necesarias del sistema

### 7.4 Servidor se Abre en Ventana Separada
Si al hacer clic en "Start Server" se abre otra ventana:
- Este problema está solucionado en la versión actualizada
- El servidor ahora se ejecuta en modo embebido dentro del mismo proceso
- Reconstruye el ejecutable con las nuevas versiones de los archivos

## 8. Distribución

### 7.1 Archivos a Distribuir
- Ejecutable: `dist/noticing_game_server`
- README.md
- Licencia
- Documentación

### 7.2 Requisitos Mínimos
- SO: Linux (especificar distribuciones soportadas)
- RAM: 256MB mínimo
- Espacio en disco: ~100MB
- Conexión a Internet

### 7.3 Instrucciones de Instalación
1. Extraer el archivo distribuible
2. Dar permisos de ejecución
3. Ejecutar el programa
4. Configurar auto-inicio (opcional)

## 9. Notas Adicionales

### 9.1 Diferencias entre Desarrollo y Ejecutable
- **Desarrollo**: El servidor se ejecuta como subproceso separado
- **Ejecutable**: El servidor se ejecuta en modo embebido (mismo proceso)
- Ambos modos son funcionalmente equivalentes para el usuario final

### 9.2 Script de Construcción Automática
El archivo `build_executable_linux.py` automatiza todo el proceso:
- Verifica dependencias
- Crea el archivo spec
- Construye el ejecutable
- Realiza pruebas básicas
- Limpia archivos temporales

### 9.3 Archivos de Configuración
- Configuración: ~/.noticing_game_config.json
- Logs: ~/.noticing_game_logs/

### 9.4 Auto-inicio
- Configurable desde Settings en la interfaz
- Se integra con el sistema de inicio del escritorio

### 9.5 Actualizaciones
- Distribuir nuevas versiones como paquete completo
- Mantener changelog
- Documentar proceso de actualización
```
