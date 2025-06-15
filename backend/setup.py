#!/usr/bin/env python3
"""
Setup script for Noticing Game Backend
Subtitle extraction server using yt-dlp for the Noticing Game Chrome extension.
"""

from setuptools import setup, find_packages
import os

# Read the README file for long description
def read_readme():
    readme_path = os.path.join(os.path.dirname(__file__), 'README.md')
    if os.path.exists(readme_path):
        with open(readme_path, 'r', encoding='utf-8') as f:
            return f.read()
    return "Noticing Game Backend - Subtitle extraction server for YouTube videos"

# Read requirements from requirements.txt
def read_requirements():
    requirements_path = os.path.join(os.path.dirname(__file__), 'requirements.txt')
    requirements = []

    if os.path.exists(requirements_path):
        with open(requirements_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # Skip empty lines and comments
                if line and not line.startswith('#'):
                    # Remove inline comments
                    if '#' in line:
                        line = line.split('#')[0].strip()
                    requirements.append(line)

    return requirements

setup(
    name="noticing-game-backend",
    version="1.0.0",
    author="Rafael Hernandez Bustamante",
    author_email="your.email@example.com",  # Update with actual email
    description="Backend server for Noticing Game Chrome extension - YouTube subtitle extraction",
    long_description=read_readme(),
    long_description_content_type="text/markdown",
    url="https://github.com/Rudull/noticing-game",  # Update with actual repo URL
    project_urls={
        "Bug Reports": "https://github.com/Rudull/noticing-game/issues",
        "Source": "https://github.com/Rudull/noticing-game",
        "Documentation": "https://github.com/Rudull/noticing-game/blob/main/README.md",
    },

    # Package configuration
    packages=find_packages(),
    py_modules=['subtitle_server'],

    # Dependencies
    install_requires=read_requirements(),

    # Python version requirement
    python_requires=">=3.8",

    # Classification
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: End Users/Desktop",
        "Intended Audience :: Education",
        "Topic :: Education",
        "Topic :: Multimedia :: Video",
        "Topic :: Internet :: WWW/HTTP :: Dynamic Content",
        "License :: OSI Approved :: GNU General Public License v3 (GPLv3)",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
        "Environment :: Web Environment",
        "Framework :: Flask",
    ],

    # Keywords for PyPI
    keywords="youtube subtitles language-learning education chrome-extension yt-dlp",

    # Entry points for command-line scripts
    entry_points={
        'console_scripts': [
            'noticing-game-server=subtitle_server:main',
        ],
    },

    # Additional files to include
    include_package_data=True,
    package_data={
        '': ['requirements.txt', 'README.md', 'LICENSE'],
    },

    # Optional dependencies
    extras_require={
        'dev': [
            'pytest>=7.4.0',
            'pytest-flask>=1.2.0',
            'pytest-cov>=4.1.0',
            'black>=23.0.0',
            'flake8>=6.0.0',
            'mypy>=1.5.0',
        ],
        'test': [
            'pytest>=7.4.0',
            'pytest-flask>=1.2.0',
            'pytest-cov>=4.1.0',
        ],
    },

    # Zip safe
    zip_safe=False,

    # License
    license="GPL-3.0",

    # Platform
    platforms=["any"],
)
