#!/usr/bin/env python3
"""
Sync version from manifest.json to package.json
This ensures the version is centralized in manifest.json
"""
import json
import os

# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))

# Paths to the files
manifest_path = os.path.join(script_dir, 'manifest.json')
package_path = os.path.join(script_dir, 'package.json')

def sync_version():
    """Read version from manifest.json and update package.json"""
    
    # Read manifest.json
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    
    version = manifest.get('version')
    if not version:
        print("Error: No version found in manifest.json")
        return False
    
    # Read package.json
    with open(package_path, 'r', encoding='utf-8') as f:
        package = json.load(f)
    
    # Update version
    old_version = package.get('version')
    package['version'] = version
    
    # Write back to package.json
    with open(package_path, 'w', encoding='utf-8') as f:
        json.dump(package, f, indent=2, ensure_ascii=False)
        f.write('\n')  # Add newline at end of file
    
    print(f"✓ Version synced: {old_version} → {version}")
    print(f"  manifest.json: {version}")
    print(f"  package.json: {version}")
    
    return True

if __name__ == '__main__':
    success = sync_version()
    exit(0 if success else 1)
