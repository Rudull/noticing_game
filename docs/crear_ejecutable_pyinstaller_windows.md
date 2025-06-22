# Crear Ejecutable del Servidor Noticing Game en Windows con PyInstaller

## 1. Preparación del Entorno

### 1.1 Ubicación del Proyecto
Abrir Command Prompt o PowerShell en la raíz del proyecto backend:
```cmd
cd C:\ruta\al\proyecto\noticing_game\backend
```

### 1.2 Entorno Virtual (Recomendado)
```cmd
# Crear entorno virtual (si no existe)
python -m venv venv

# Activar entorno virtual
venv\Scripts\activate
```

### 1.3 Dependencias
Instalar todas las dependencias necesarias:
```cmd
# Actualizar pip
python -m pip install --upgrade pip

# Instalar PyInstaller y herramientas
pip install pyinstaller
pip install -r requirements.txt
pip install pystray Pillow

# Verificar instalación de tkinter (incluido en Python estándar)
python -c "import tkinter; print('tkinter OK')"
```

## 2. Método Recomendado: Script Automático

### 2.1 Usar el Script de Construcción
```cmd
# Construir ejecutable automáticamente
python build_executable.py

# Con opciones adicionales
python build_executable.py --clean --test

# Para depuración
python build_executable.py --debug

# Para bundle de directorio (más rápido)
python build_executable.py --onedir
```

El script automático:
- ✅ Verifica todas las dependencias
- 🧹 Limpia archivos previos automáticamente
- 🔧 Crea el archivo spec optimizado
- 🏗️ Construye el ejecutable
- 🧪 Realiza pruebas básicas
- 📊 Muestra resultados detallados

## 3. Método Manual: Configurar PyInstaller

### 3.1 Crear Spec Inicial (Solo si no existe)
```cmd
pyi-makespec --onefile --windowed --add-data "subtitle_server.py;." desktop_app.py
```

### 3.2 Archivo Spec Optimizado
El archivo `desktop_app.spec` ya está configurado correctamente. Si necesitas recrearlo:

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
```cmd
pyinstaller --clean --noconfirm desktop_app.spec
```

### 4.2 Ubicación del Resultado
El ejecutable se creará en:
```
backend\
└── dist\
    └── noticing_game_server.exe
```

## 5. Verificación y Pruebas

### 5.1 Ejecutar el Programa
```cmd
# Desde el directorio backend
dist\noticing_game_server.exe

# O hacer doble clic en el archivo
```

### 5.2 Verificar Funcionalidades
- ✅ La interfaz gráfica debe abrirse correctamente
- ✅ El servidor debe iniciar sin abrir ventanas duplicadas (modo embebido)
- ✅ El ícono del system tray debe verse correctamente
- ✅ Los settings deben guardarse y cargarse correctamente
- ✅ El servidor debe poder detenerse correctamente
- ✅ La extracción de subtítulos debe funcionar

### 5.3 Solución a Problemas Comunes

#### Problema: Ventanas Duplicadas al Iniciar Servidor
**Solución:** Este problema está resuelto en la versión actualizada. El código detecta automáticamente si está ejecutándose como ejecutable y usa modo embebido.

#### Problema: Servidor No se Detiene
**Solución:** El código actualizado incluye un mecanismo mejorado para detener el servidor embebido.

#### Problema: Settings No se Guardan
**Solución:** La ventana de settings se ha corregido para mostrar botones visibles y guardar configuración correctamente.

## 6. Características del Ejecutable

### 6.1 Modo Embebido del Servidor
- **Desarrollo**: El servidor se ejecuta como subproceso separado
- **Ejecutable**: El servidor se ejecuta en modo embebido (mismo proceso)
- **Ventaja**: No hay ventanas duplicadas, mejor control del servidor

### 6.2 Detección Automática
```python
# El código detecta automáticamente el modo de ejecución
is_frozen = getattr(sys, 'frozen', False)
if is_frozen:
    # Modo ejecutable - servidor embebido
    start_embedded_server()
else:
    # Modo desarrollo - subproceso
    start_subprocess_server()
```

### 6.3 Mejoras en la Interfaz
- ✨ Ícono del system tray mejorado con bordes suaves
- 🔧 Ventana de settings con botones visibles y funcionales
- 💾 Guardado automático de configuración
- 🚀 Auto-inicio configurable con Windows

## 7. Requisitos del Sistema

### 7.1 Software Necesario
- Windows 10 o superior (64-bit recomendado)
- Python 3.8+ (para desarrollo, no necesario para el ejecutable)
- Visual C++ Redistributable (usualmente incluido)

### 7.2 Permisos Requeridos
- Acceso a red (puerto 5000)
- Permisos de escritura en directorio del usuario
- Permiso para modificar registro (auto-inicio)

### 7.3 Hardware Mínimo
- RAM: 256MB disponible
- Espacio en disco: ~150MB
- Conexión a Internet para extracción de subtítulos

## 8. Distribución

### 8.1 Archivos a Distribuir
Para distribución simple (archivo único):
- **Ejecutable**: `dist\noticing_game_server.exe`
- **Documentación**: README.md, licencia
- **Instalador** (opcional): Crear con NSIS o similar

### 8.2 Instalación para el Usuario Final
1. Descargar `noticing_game_server.exe`
2. Colocar en directorio deseado (ej: `C:\Program Files\Noticing Game\`)
3. Ejecutar por primera vez
4. Configurar auto-inicio desde Settings si se desea
5. Permitir acceso en firewall si Windows lo solicita

### 8.3 Desinstalación
1. Detener la aplicación si está ejecutándose
2. Deshabilitar auto-inicio desde Settings
3. Eliminar el archivo ejecutable
4. Eliminar configuración: `%USERPROFILE%\.noticing_game_config.json`
5. Eliminar logs: `%USERPROFILE%\.noticing_game_logs\`

## 9. Solución de Problemas Avanzados

### 9.1 Error "Failed to execute script"
```cmd
# Reconstruir con debug habilitado
python build_executable.py --debug

# O ejecutar desde línea de comandos para ver errores
cd dist
noticing_game_server.exe
```

### 9.2 Antivirus Bloquea el Ejecutable
- Los ejecutables de PyInstaller a veces son marcados como falsos positivos
- Agregar excepción en el antivirus
- Firmar digitalmente el ejecutable para distribución comercial

### 9.3 Error de DLL Faltante
```cmd
# Instalar Visual C++ Redistributable desde Microsoft
# https://docs.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist
```

### 9.4 Puerto 5000 en Uso
- La aplicación detecta automáticamente puertos ocupados
- Configurar puerto alternativo en Settings
- Verificar que no hay otras aplicaciones usando el puerto

## 10. Optimización y Personalización

### 10.1 Reducir Tamaño del Ejecutable
```python
# En desktop_app.spec, agregar exclusiones:
excludes=[
    'test', 'unittest', 'distutils', 'setuptools',
    'numpy', 'matplotlib',  # Si no se usan
    'scipy', 'pandas'       # Si no se usan
]
```

### 10.2 Agregar Ícono Personalizado
```cmd
# Al crear el spec, agregar ícono
pyi-makespec --onefile --windowed --icon=icon.ico desktop_app.py
```

### 10.3 Firma Digital (Para Distribución)
```cmd
# Usar signtool.exe del Windows SDK
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com noticing_game_server.exe
```

## 11. Automatización Avanzada

### 11.1 Script de Build con CI/CD
```cmd
# Para integración continua
python build_executable.py --clean --test --onefile
```

### 11.2 Build Multi-versión
```cmd
# Para diferentes versiones de Python
python38 build_executable.py --clean
python39 build_executable.py --clean
python310 build_executable.py --clean
```

## 12. Notas de Desarrollo

### 12.1 Diferencias entre Entornos
| Característica | Desarrollo | Ejecutable |
|---------------|------------|------------|
| Servidor | Subproceso | Embebido |
| Inicio | Normal | Auto-detección |
| Debugging | Fácil | Limitado |
| Distribución | Complejo | Simple |

### 12.2 Mejores Prácticas
- ✅ Siempre probar el ejecutable en máquina limpia
- ✅ Verificar funcionalidad completa antes de distribuir
- ✅ Mantener changelog para actualizaciones
- ✅ Documentar requisitos del sistema claramente
- ✅ Proporcionar instrucciones de desinstalación

### 12.3 Actualizaciones Futuras
- Implementar auto-actualizador
- Crear instalador MSI profesional
- Agregar telemetría básica (opcional)
- Mejorar manejo de errores y logs

## 13. Soporte y Mantenimiento

### 13.1 Logs y Debugging
- **Logs de aplicación**: `%USERPROFILE%\.noticing_game_logs\desktop_app.log`
- **Configuración**: `%USERPROFILE%\.noticing_game_config.json`
- **Logs del servidor**: Integrados en la aplicación principal

### 13.2 Reporte de Problemas
Para reportar problemas, incluir:
1. Versión de Windows
2. Logs de la aplicación
3. Pasos para reproducir el problema
4. Configuración actual

### 13.3 Versionado
- Usar versionado semántico (MAJOR.MINOR.PATCH)
- Mantener compatibilidad de configuración entre versiones menores
- Documentar cambios que rompen compatibilidad