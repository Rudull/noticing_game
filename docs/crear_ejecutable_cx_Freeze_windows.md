# Crear Ejecutable del Servidor Noticing Game en Windows con cx_Freeze

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

# Instalar cx_Freeze y herramientas
pip install cx_Freeze
pip install -r requirements.txt
pip install pystray Pillow

# Verificar instalación de tkinter (incluido en Python estándar)
python -c "import tkinter; print('tkinter OK')"
```

## 2. Crear setup.py para cx_Freeze

### 2.1 Crear Archivo de Configuración
Crear el archivo `setup_cx_freeze.py` en el directorio backend:

```python
import sys
from cx_Freeze import setup, Executable
import os
from pathlib import Path

# Obtener el directorio actual
script_dir = Path(__file__).parent

# Configuración de construcción
build_exe_options = {
    "packages": [
        "flask",
        "flask_cors", 
        "yt_dlp",
        "requests",
        "tkinter",
        "tkinter.ttk",
        "tkinter.scrolledtext",
        "PIL",
        "PIL.Image",
        "PIL.ImageDraw",
        "pystray",
        "tempfile",
        "logging",
        "datetime",
        "re",
        "json",
        "xml.etree.ElementTree",
        "urllib.request",
        "urllib.error",
        "webbrowser",
        "threading",
        "socket",
        "subprocess",
        "xml.parsers.expat",
        "email.mime.multipart",
        "email.mime.text"
    ],
    "include_files": [
        ("subtitle_server.py", "subtitle_server.py"),
        ("requirements.txt", "requirements.txt"),
        ("README.md", "README.md")
    ],
    "excludes": [
        "test",
        "unittest",
        "distutils",
        "setuptools"
    ],
    "optimize": 2,
    "include_msvcrt": True
}

# Configuración base para Windows GUI
base = "Win32GUI" if sys.platform == "win32" else None

# Configuración del ejecutable
executable = Executable(
    script="desktop_app.py",
    base=base,
    target_name="noticing_game_server.exe",
    icon=None,  # Agregar archivo .ico si tienes uno
    shortcut_name="Noticing Game Server",
    shortcut_dir="DesktopFolder"
)

# Configuración del setup
setup(
    name="Noticing Game Server",
    version="1.0.0",
    author="Rafael Hernandez Bustamante",
    description="Backend server for Noticing Game Chrome extension - YouTube subtitle extraction",
    long_description="Desktop application to manage the Noticing Game subtitle extraction server with GUI interface and system tray integration.",
    options={"build_exe": build_exe_options},
    executables=[executable]
)
```

### 2.2 Script de Construcción Automática
Crear `build_cx_freeze.py` para automatizar el proceso:

```python
#!/usr/bin/env python3
"""
Noticing Game - cx_Freeze Build Script for Windows

This script builds a Windows executable using cx_Freeze.
"""

import sys
import os
import subprocess
import shutil
from pathlib import Path

def print_banner():
    print("=" * 70)
    print("🎮 NOTICING GAME - CX_FREEZE BUILDER (WINDOWS)")
    print("=" * 70)
    print("Building Windows executable using cx_Freeze")
    print()

def check_dependencies():
    print("Checking dependencies...")
    
    # Check cx_Freeze
    try:
        import cx_Freeze
        print(f"✅ cx_Freeze: Available (version: {cx_Freeze.version})")
    except ImportError:
        print("❌ cx_Freeze: Missing")
        return False
    
    required = ['flask', 'flask_cors', 'yt_dlp', 'requests', 'tkinter']
    missing = []
    
    for pkg in required:
        try:
            __import__(pkg)
            print(f"✅ {pkg}: Available")
        except ImportError:
            print(f"❌ {pkg}: Missing")
            missing.append(pkg)
    
    if missing:
        print(f"\n❌ Missing packages: {', '.join(missing)}")
        return False
    
    return True

def clean_build():
    print("Cleaning previous build...")
    script_dir = Path(__file__).parent
    
    for dir_name in ['build', 'dist']:
        dir_path = script_dir / dir_name
        if dir_path.exists():
            print(f"   Removing {dir_path}")
            shutil.rmtree(dir_path)
    
    print("✅ Clean completed")

def build_executable():
    print("Building executable with cx_Freeze...")
    
    try:
        result = subprocess.run(
            [sys.executable, "setup_cx_freeze.py", "build"],
            check=True,
            capture_output=True,
            text=True
        )
        print("✅ Build completed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print("❌ Build failed!")
        print(f"Error: {e}")
        if e.stdout:
            print("STDOUT:", e.stdout)
        if e.stderr:
            print("STDERR:", e.stderr)
        return False

def show_results():
    script_dir = Path(__file__).parent
    build_dir = script_dir / "build"
    
    # Find the executable
    exe_path = None
    for item in build_dir.rglob("*.exe"):
        if "noticing_game_server" in item.name:
            exe_path = item
            break
    
    if exe_path:
        size_mb = exe_path.stat().st_size / (1024 * 1024)
        print(f"\n🎉 SUCCESS!")
        print(f"📄 Executable: {exe_path}")
        print(f"📏 Size: {size_mb:.1f} MB")
        print(f"\n🚀 To run:")
        print(f"   {exe_path}")
        print(f"\n📦 Distribution folder:")
        print(f"   {exe_path.parent}")
    else:
        print("\n❌ Executable not found!")

def main():
    print_banner()
    
    if not check_dependencies():
        print("\nInstall missing dependencies with:")
        print("   pip install cx_Freeze flask flask-cors yt-dlp requests pystray Pillow")
        sys.exit(1)
    
    clean_build()
    
    if not build_executable():
        sys.exit(1)
    
    show_results()
    print("\n✨ Build completed!")

if __name__ == "__main__":
    main()
```

## 3. Crear el Ejecutable

### 3.1 Método Recomendado: Script Automático
```cmd
# Construir automáticamente
python build_cx_freeze.py
```

### 3.2 Método Manual
```cmd
# Construir usando setup.py directamente
python setup_cx_freeze.py build
```

## 4. Estructura de Salida

El ejecutable se creará en:
```
backend/
└── build/
    └── exe.win-amd64-3.x/  # La versión puede variar
        ├── noticing_game_server.exe
        ├── lib/                # Bibliotecas Python
        ├── subtitle_server.py
        ├── requirements.txt
        └── README.md
```

## 5. Verificación y Pruebas

### 5.1 Ejecutar el Programa
```cmd
# Navegar al directorio de build
cd build\exe.win-amd64-3.x
noticing_game_server.exe
```

### 5.2 Verificar Funcionalidades
- La interfaz gráfica debe abrirse
- El servidor debe iniciar correctamente (modo embebido)
- El system tray debe estar disponible
- La extracción de subtítulos debe funcionar
- Los settings deben guardarse correctamente

## 6. Ventajas de cx_Freeze

### 6.1 Beneficios
- Construcción más rápida que PyInstaller
- Menor tamaño de ejecutable en algunos casos
- Mejor compatibilidad con algunas bibliotecas
- Estructura de archivos más transparente

### 6.2 Consideraciones
- Requiere distribución de toda la carpeta
- No crea ejecutable de un solo archivo por defecto
- Menos opciones de personalización que PyInstaller

## 7. Distribución

### 7.1 Archivos a Distribuir
Distribuir toda la carpeta `exe.win-amd64-3.x/` que contiene:
- Ejecutable principal: `noticing_game_server.exe`
- Bibliotecas necesarias en `lib/`
- Archivos de datos incluidos

### 7.2 Requisitos del Sistema
- Windows 10 o superior (64-bit recomendado)
- Visual C++ Redistributable (usualmente incluido)
- Acceso a Internet
- Puerto 5000 disponible

### 7.3 Instrucciones de Instalación
1. Extraer/copiar toda la carpeta del ejecutable
2. Ejecutar `noticing_game_server.exe`
3. Configurar auto-inicio si es necesario
4. Permitir acceso a través del firewall si se solicita

## 8. Solución de Problemas

### 8.1 Error "Missing DLL"
```cmd
# Reinstalar Visual C++ Redistributable
# Descargar desde Microsoft:
# https://docs.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist
```

### 8.2 Error de Importación
- Verificar que todas las dependencias estén en `build_exe_options["packages"]`
- Agregar módulos faltantes manualmente

### 8.3 Error de Archivos
- Verificar que los archivos estén en `include_files`
- Comprobar rutas relativas

### 8.4 Servidor No Inicia
- Verificar puerto 5000 disponible
- Revisar permisos de firewall
- Comprobar logs en la aplicación

## 9. Optimización

### 9.1 Reducir Tamaño
```python
# En setup_cx_freeze.py, agregar exclusiones:
"excludes": [
    "test", "unittest", "distutils", "setuptools",
    "numpy", "matplotlib",  # Si no se usan
    "scipy", "pandas"       # Si no se usan
]
```

### 9.2 Mejorar Rendimiento
- Usar `"optimize": 2` en build_exe_options
- Excluir módulos innecesarios
- Comprimir archivos si es necesario

## 10. Comparación con PyInstaller

| Característica | cx_Freeze | PyInstaller |
|---------------|-----------|-------------|
| Velocidad construcción | ⚡ Rápido | 🐌 Lento |
| Tamaño ejecutable | 📦 Medio | 📦 Variable |
| Archivo único | ❌ No | ✅ Sí |
| Compatibilidad | 🔧 Buena | 🔧 Excelente |
| Facilidad uso | 👍 Fácil | 👍 Fácil |

## 11. Notas Adicionales

### 11.1 Modo Embebido
- El servidor se ejecuta en el mismo proceso que la GUI
- No se abren ventanas duplicadas
- Mejor integración y control

### 11.2 Archivos de Configuración
- Configuración: `%USERPROFILE%\.noticing_game_config.json`
- Logs: `%USERPROFILE%\.noticing_game_logs\`

### 11.3 Auto-inicio en Windows
- Se configura automáticamente en el registro de Windows
- Configurable desde Settings en la interfaz

### 11.4 Actualizaciones
- Distribuir nueva carpeta completa para actualizaciones
- Mantener configuración del usuario
- Documentar cambios en cada versión