#!/bin/bash

# Navigate to the project directory
# Replace '/path/to/your/project' with the actual path to your project directory
cd /Users/adriancole/Desktop/shapefile_uploader

# Activate the virtual environment
source env/bin/activate

# Start the Python HTTP server
python -m http.server 8000

# Note: The script will keep running until you stop the server (usually with Ctrl+C)
# When you stop the server, it will automatically deactivate the virtual environment