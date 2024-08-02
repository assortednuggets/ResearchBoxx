let map, layerControl, shapefileLayers = {};
let SQL;

// Initialize map and base layer
function initMap() {
    map = L.map('map').setView([37.8, -96], 4);
    layerControl = L.control.layers().addTo(map);

    let baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    layerControl.addBaseLayer(baseLayer, "OpenStreetMap");
}

// **CORRECTED AND RENAMED FUNCTION:**
async function initializeSql() { 
    if (!SQL) { 
        try {
            SQL = await window.initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${file}`
            });
            console.log("SQL.js successfully initialized!"); 
        } catch (error) {
            console.error("SQL.js Initialization error:", error);
            throw error; 
        }
    }
    return SQL; 
}

// GeoPackage layers to load
const huLayers = ['WBDHU2', 'WBDHU4', 'WBDHU6', 'WBDHU8', 'WBDHU10', 'WBDHU12', 'WBDHU14', 'WBDHU16'];

// Function to load GeoPackage layers
async function loadGeoPackageLayers() {
    const geopackageUrl = 'NHDPLUS_H_1014_HU4_GPKG.gpkg'; 

    try {
        const response = await fetch(geopackageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const db = new SQL.Database(new Uint8Array(arrayBuffer));

        for (const layerName of huLayers) {
            try {
                const result = db.exec(`SELECT AsBinary(geom) as geom, * FROM ${layerName}`);
                
                if (result.length > 0) {
                    const features = result[0].values.map(row => {
                        const geom = shapefile.parseGeometry(row[0]);
                        const properties = {};
                        result[0].columns.forEach((col, index) => {
                            if (col !== 'geom') {
                                properties[col] = row[index];
                            }
                        });
                        return {
                            type: "Feature",
                            geometry: geom,
                            properties: properties
                        };
                    });

                    const geojson = {
                        type: "FeatureCollection",
                        features: features
                    };

                    addLayerToMap(layerName, geojson);
                }
            } catch (error) {
                console.error(`Error loading layer ${layerName}:`, error);
            }
        }
    } catch (error) {
        console.error("Error loading GeoPackage:", error);
    }
}

// Function to add a layer to the map
function addLayerToMap(layerName, geojson) {
    const color = getRandomColor();
    shapefileLayers[layerName] = L.geoJSON(geojson, {
        style: function (feature) {
            return {color: color, weight: 2, fillOpacity: 0.2};
        },
        onEachFeature: function (feature, layer) {
            let popupContent = '<table>';
            for (let prop in feature.properties) {
                popupContent += `<tr><td>${prop}</td><td>${feature.properties[prop]}</td></tr>`;
            }
            popupContent += '</table>';
            layer.bindPopup(popupContent);
        }
    }).addTo(map);

    layerControl.addOverlay(shapefileLayers[layerName], layerName);
    updateLayersPanel();
    addStyleControl(layerName);
}

function getRandomColor() {
    return '#' + Math.floor(Math.random()*16777215).toString(16);
}

function addStyleControl(layerName) {
    let controlDiv = document.createElement('div');
    controlDiv.style.padding = '6px';
    controlDiv.style.backgroundColor = 'white';
    controlDiv.innerHTML = `
        <label for="${layerName}-color">Color for ${layerName}:</label>
        <input type="color" id="${layerName}-color" value="${shapefileLayers[layerName].options.style().color}">
    `;
    document.querySelector('.leaflet-top.leaflet-right').appendChild(controlDiv);

    document.getElementById(`${layerName}-color`).addEventListener('change', function(e) {
        shapefileLayers[layerName].setStyle({color: e.target.value});
    });
}

function updateLayersPanel() {
    let layersDiv = document.getElementById('layers');
    layersDiv.innerHTML = '<p>Base layer: OpenStreetMap</p>';
    for (let layerName in shapefileLayers) {
        layersDiv.innerHTML += `<p>Layer: ${layerName}</p>`;
    }
    console.log("Layers panel updated");
}

function groupFiles(files) {
    let groups = {};
    for (let file of files) {
        let baseName = file.name.split('.').slice(0, -1).join('.');
        if (!groups[baseName]) groups[baseName] = {};
        let extension = file.name.split('.').pop().toLowerCase();
        groups[baseName][extension] = file;
    }
    return Object.values(groups);
}

function processFileGroup(fileGroup) {
    if (!fileGroup.shp || !fileGroup.dbf) {
        alert('Please select at least .shp and .dbf files for each shapefile');
        return;
    }

    let fileReads = ['shp', 'dbf', 'prj', 'cpg'].map(ext => {
        if (fileGroup[ext]) {
            return readFile(fileGroup[ext]).then(content => ({ [ext]: content }));
        }
        return Promise.resolve({});
    });

    Promise.all(fileReads)
        .then(results => {
            let fileContents = Object.assign({}, ...results);
            console.log("File contents loaded:", Object.keys(fileContents));
            
            if (fileContents.prj) {
                const prj = new TextDecoder().decode(fileContents.prj);
                console.log("PRJ content:", prj);
                proj4.defs('EPSG:NAD83', prj);
            }

            return shapefile.read(fileContents.shp, fileContents.dbf, {
                encoding: fileContents.cpg ? new TextDecoder().decode(fileContents.cpg).trim() : undefined
            });
        })
        .then(geojson => {
            console.log("GeoJSON created:", JSON.stringify(geojson, null, 2));
            if (!geojson || !geojson.features || geojson.features.length === 0) {
                throw new Error("The shapefile appears to be empty or invalid.");
            }

            if (proj4.defs('EPSG:NAD83')) {
                geojson.features.forEach(feature => {
                    if (feature.geometry.type === "Polygon") {
                        feature.geometry.coordinates[0] = feature.geometry.coordinates[0].map(coord => 
                            proj4('EPSG:NAD83', 'EPSG:4326', coord)
                        );
                    }
                });
            }

            let layerName = fileGroup.shp.name.split('.').slice(0, -1).join('.');
            addLayerToMap(layerName, geojson);
            map.fitBounds(shapefileLayers[layerName].getBounds());
        })
        .catch(error => {
            console.error("Error processing shapefile:", error);
            console.error("Error stack:", error.stack);
            alert("Error processing shapefile: " + error.message);
        });
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = e => {
            console.log(`File ${file.name} read, size: ${e.target.result.byteLength} bytes`);
            resolve(e.target.result);
        };
        reader.onerror = e => reject(e);
        reader.readAsArrayBuffer(file);
    });
}

// Initialize everything
async function init() {
    initMap();
    try {
        SQL = await initializeSql(); // Call the renamed initializeSql function
        await loadGeoPackageLayers(); 

        // Set up event listeners
        document.getElementById('file-input').addEventListener('change', function(e) {
            let files = e.target.files;
            if (files.length === 0) return;
            let fileGroups = groupFiles(files);
            fileGroups.forEach(group => processFileGroup(group));
        });

        document.getElementById('clear-button').addEventListener('click', function() {
            for (let layerName in shapefileLayers) {
                map.removeLayer(shapefileLayers[layerName]);
                layerControl.removeLayer(shapefileLayers[layerName]);
            }
            shapefileLayers = {};
            updateLayersPanel();
            let controls = document.querySelector('.leaflet-top.leaflet-right');
            while (controls.childNodes.length > 1) {
                controls.removeChild(controls.lastChild);
            }
            console.log("Map cleared");
        });
    } catch (error) {
        console.error("Initialization error:", error);
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', init);