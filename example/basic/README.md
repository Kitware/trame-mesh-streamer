## Introduction

This example aim to load a vtp file and let you see it using Remote rendering, Local rendering and Local rendering with progressive geometry delivery.

## Python environment setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install vtk trame trame-vuetify trame-vtk trame-mesh-streamer
```

## Running example

```bash
python ./app.py --data /path/to/your/file.vtp
```
