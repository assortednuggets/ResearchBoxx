#   list all layers oin a GPKG file

from osgeo import ogr

# Path to your GeoPackage file
gpkg_path = '/Users/adriancole/Desktop/shapefile_uploader/NHDPLUS_H_1014_HU4_GPKG/NHDPLUS_H_1014_HU4_GPKG.gpkg'

try:
    # Open the GeoPackage file
    gpkg = ogr.Open(gpkg_path)
    
    if gpkg is None:
        print(f"Error: Could not open the GeoPackage file at {gpkg_path}")
    else:
        # Get the number of layers
        layer_count = gpkg.GetLayerCount()
        
        print(f"The GeoPackage contains {layer_count} layers:")
        
        # List all layers
        for i in range(layer_count):
            layer = gpkg.GetLayerByIndex(i)
            print(f"{i+1}. {layer.GetName()}")
        
        # Close the file
        gpkg = None

except Exception as e:
    print(f"An error occurred: {str(e)}")