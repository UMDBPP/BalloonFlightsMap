import * as BalloonBaseMap from "BalloonBaseMap"
import * as maplibregl from "maplibre-gl";
import { VectorTextProtocol } from "maplibre-gl-vector-text-protocol"


const layer_defs = BalloonBaseMap.layer_defs;
var map, layer_switcher;
var visible_flights_data = {};

/**
 * This protocol handler will pass its parameters to the appropriate protocol handler and intercept the returned data to fragment for the 3D display
 * @param {*} params 
 * @param {*} abortController 
 */
async function flights_protocol(params, abortController){
    let data;
    let [prefix, url] = params.url.split("://");
    params.url = url;

    // Get the flight data
    if(prefix === "flightskml"){
        // console.log("flights_protocol kml " + params.url);
        params.url = "kml://" + url;
        data = (await VectorTextProtocol(params, abortController))["data"];
    } else{
        // console.log("flights_protocol default " + params.url);
        let response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        data = await response.json();
    }

    let flight_id = url.split("/").at(-1).split(".")[0];
    visible_flights_data[flight_id] = [];
    // The first object in the visible_flights_data arrays is a meta-properties object, actual data starts at 1
    visible_flights_data[flight_id].push({});

    for(let idx = 0, num_features = data["features"].length; idx < num_features; idx++){
        // If a feature doesn't have geometry, remove it
        if(!data["features"][idx]["geometry"]){
            data["features"].splice(idx, 1);
            idx--;
            num_features--;
            console.warn(`flights_protocol: Encountered null geometry feature in "` + flight_id + `". Skipping it`)
            continue;
        }

        let feature_data = {};
        feature_data["name"] = data["features"][idx]["properties"]["name"];
        feature_data["type"] = data["features"][idx]["geometry"]["type"];

        // Handle the geofence, assuming the only polygon feature is the geofence
        if(data["features"][idx]["geometry"]["type"] === "Polygon"){
            feature_data["coordinates"] = data["features"][idx]["geometry"]["coordinates"];

        } else {
            feature_data["altitudes_m"] = [];
            let num_coords = data["features"][idx]["geometry"]["coordinates"].length;
            // Save the flight start and end locations to the flight's meta-properties
            if(!visible_flights_data[flight_id][0]["start_location"]){
                visible_flights_data[flight_id][0]["start_location"] = Array.isArray(data["features"][idx]["geometry"]["coordinates"][0]) ? data["features"][idx]["geometry"]["coordinates"][0] : data["features"][idx]["geometry"]["coordinates"];
            }
            if(data["features"][idx]["geometry"]["coordinates"][0].length > 1){
                visible_flights_data[flight_id][0]["end_location"] = data["features"][idx]["geometry"]["coordinates"].at(-1);
            } else{
                visible_flights_data[flight_id][0]["end_location"] = data["features"][idx]["geometry"]["coordinates"];
            }

            // Handle individual points
            if(data["features"][idx]["geometry"]["type"] === "Point"){
                // The Choppies KML files don't seem to record the times for point events, 
                // so we can interpolate the times from the linestrings around it, if they have them

                // If the current feature isn't the first or last, use the average time of the two surrounding coordinates
                if(idx - 1 >= 0 && idx + 1 < num_features){
                    // If both the features before and after have times,
                    if(data["features"][idx - 1]["properties"]["coordinateProperties"] && data["features"][idx - 1]["properties"]["coordinateProperties"]["times"] &&
                        data["features"][idx + 1]["properties"]["coordinateProperties"] && data["features"][idx + 1]["properties"]["coordinateProperties"]["times"]
                    ){
                        // Get the last time from the feature before and the first time from the feature after
                        let last_time = new Date(data["features"][idx - 1]["properties"]["coordinateProperties"]["times"].at(-1));
                        let next_time = new Date(data["features"][idx + 1]["properties"]["coordinateProperties"]["times"][0]);

                        let interpolated_time = new Date((next_time.getTime() - last_time.getTime())/2 + last_time.getTime());

                        feature_data["times"] = [interpolated_time.toISOString()];
                    }
                // If the current feature is the first, use the time of the next coordinate
                } else if((idx == 0) && data["features"][idx + 1]["properties"]["coordinateProperties"] && data["features"][idx + 1]["properties"]["coordinateProperties"]["times"]){
                    feature_data["times"] = [data["features"][idx + 1]["properties"]["coordinateProperties"]["times"][0]];
                // If the current feature is the last, use the time of the previous coordinate
                } else if((idx == num_features - 1) && data["features"][idx - 1]["properties"]["coordinateProperties"] && data["features"][idx - 1]["properties"]["coordinateProperties"]["times"]){
                    feature_data["times"] = [data["features"][idx - 1]["properties"]["coordinateProperties"]["times"].at(-1)];
                }

                feature_data["altitudes_m"].push(data["features"][idx]["geometry"]["coordinates"][2]);

            // Handle the flight linestrings
            } else if(data["features"][idx]["geometry"]["type"] === "LineString"){
                // If the linestring has times for each coordinate, save those to use
                if(data["features"][idx]["properties"]["coordinateProperties"] && data["features"][idx]["properties"]["coordinateProperties"]["times"]){
                    feature_data["times"] = [];
                    for(let idx_coord = 0; idx_coord < num_coords; idx_coord++){
                        feature_data["altitudes_m"].push(data["features"][idx]["geometry"]["coordinates"][idx_coord][2]);
                        feature_data["times"].push(data["features"][idx]["properties"]["coordinateProperties"]["times"][idx_coord]);
                    }
                // If it doesn't, only save the altitudes
                } else {
                    for(let idx_coord = 0; idx_coord < num_coords; idx_coord++){
                        feature_data["altitudes_m"].push(data["features"][idx]["geometry"]["coordinates"][idx_coord][2]);
                    }
                }

                if(num_coords > 1){
                    feature_data["bbox"] = turf.bbox(data["features"][idx], {"recompute": true});
                }
            }
        }

        visible_flights_data[flight_id].push(feature_data);
    }

    // Fragment the linestrings for the 3D display
    data["features"] = data["features"].concat(BalloonBaseMap.fragment_geojson_linestrings(data["features"], {"flight_id": flight_id}));

    return { data };
}



/**
 * 
 * @param {object} style 
 * @param {object} layer_defs 
 * @param {string} [data_directory="./assets/data/flights/"] 
 */
async function init_flights_layers(style, layer_defs, data_directory="./assets/data/flights/"){
    try {
        // Get the flight list JSON file
        let response = await fetch(data_directory + "flight_list.json");
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        let flight_list_json = await response.json();
        
        // Set up variables
        layer_defs["Flights"] = [];
        let flight_filename;
        let flight_layer_color = "#00ca9b"
        let next_geofence_index = style["layers"].length;

        // Add the custom protocol handler to the map library
        maplibregl.addProtocol("flightskml", flights_protocol);
        maplibregl.addProtocol("flights", flights_protocol);

        for (let flight of flight_list_json['flights'].reverse()){ // Reverse order here so new flights are at top of list
            // Get the filename from the flight list JSON
            flight_filename = String(flight['filename']);

            // Push the flight's layer def into the layer defs object
            layer_defs["Flights"].push({
                "id": flight_filename,
                "name": flight_filename,
                "prefix": "2D_flights_" + flight_filename + (flight_filename.split("_").length === 1 ? "_default" : ""),
                "visible": false, //layer_defs["Flights"].length < 5 ? true : false, // Set the first 5 flight layers to be visible after initializing
                "properties": {
                    "filetype": flight["filetype"] ? flight["filetype"] : "geojson"
                }
            });

            // Create a source for the flight
            let flight_source = {
                "type": "geojson",
                "lineMetrics": true
            }

            // Add the sources using the custom flights protocol for the first 5 entries and an empty GeoJSON for the rest
            // (trying to make all of them active with 3D features from initial loading consumed 50+ GB of RAM before the browser crashed entirely,
            // so we'll only load each one when the user sets the associated layer in the switcher to visible and delete it when they set it to invisible)
            // if(layer_defs["Flights"].length < 5){
            //     // Handle different flight trajectory file types
            //     if(flight["filetype"] == "kml"){
            //         flight_source["data"] = "flightskml://" + data_directory + "ns" + flight_number + ".KML";

            //     } else{ // Assume GeoJSON file type by default
            //         flight_source["data"] = "flights://" + data_directory + "ns" + flight_number + ".geojson";
            //     }
            // } else{
                flight_source["data"] = {
                    "type": "FeatureCollection",
                    "features": []
                };    
            // }

            // Add the flight source to the map style
            style["sources"][flight_filename + "_source"] = flight_source;

            // Add layers to the style for each flight layer
            // Splice the geofence layer into the style layers, so it appears under all of the flight lines
            style["layers"].splice(next_geofence_index, 0, {
                "id": "2D_flights_" + flight_filename + (flight_filename.split("_").length === 1 ? "_default" : "") + "_geofence",
                "type": "fill",
                "source": flight_filename + "_source",
                "filter": ["all", ["==", ["geometry-type"], "Polygon"], ["has", "name"], ["!=", -1, ["index-of", "geofence", ["downcase", ["get", "name"]]]]],
                "layout": {
                    "visibility": "none"
                },
                "paint": {
                    "fill-color": flight_layer_color,
                    "fill-opacity": 0.2
                }
            });
            next_geofence_index++;
            style["layers"].splice(next_geofence_index, 0, {
                "id": "3D_flights_" + flight_filename + (flight_filename.split("_").length === 1 ? "_default" : "") + "_geofence",
                "type": "fill",
                "source": flight_filename + "_source",
                "filter": ["all", ["==", ["geometry-type"], "Polygon"], ["has", "name"], ["!=", -1, ["index-of", "geofence", ["downcase", ["get", "name"]]]]],
                "layout": {
                    "visibility": "none"
                },
                "paint": {
                    "fill-color": flight_layer_color,
                    "fill-opacity": 0.2
                }
            });
            next_geofence_index++;

            // Add the 2D ground track layer
            style["layers"].push({
                "id": "2D_flights_" + flight_filename + (flight_filename.split("_").length === 1 ? "_default" : ""),
                "type": "line",
                "source": flight_filename + "_source",
                "filter": ["==", ["geometry-type"], "LineString"],
                "layout": {
                    "visibility": "none"
                },
                "paint": {
                    "line-width": 5,
                    // "line-color": flight_layer_color
                    "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, "#ff00ff", 1, "#ff9900"],
                    // "line-color": ["interpolate", ["linear"], ["/", ["get", "coords_index"], ["get", "coords_total"]], 0, "#ff00ff", 1, "#ff9900"],
                }
            });

            // Add a layer for points on the 2D display
            style["layers"].push({
                "id": "2D_flights_" + flight_filename + (flight_filename.split("_").length === 1 ? "_default" : "") + "_points",
                "type": "circle",
                "source": flight_filename + "_source",
                "filter": ["==", ["geometry-type"], "Point"],
                "paint": {
                    "circle-radius": 6,
                    "circle-color": "#ffffff",
                    "circle-opacity": 1,
                    "circle-stroke-width": 6,
                    "circle-stroke-color": "#00ff2a",
                    "circle-stroke-opacity": 1
                }
            });

            // Add the 3D ground track layers
            style["layers"].push({
                "id": "3D_flights_" + flight_filename + (flight_filename.split("_").length === 1 ? "_default" : "") + "_poly",
                "type": "line",
                "source": flight_filename + "_source",
                "filter": ["all", ["==", ["geometry-type"], "Polygon"], ["case", ["has", "name"], ["==", -1, ["index-of", "geofence", ["downcase", ["get", "name"]]]], true]],
                "minzoom": 6,
                "maxzoom": 22,
                "layout": {
                    "visibility": "none"
                },
                "paint": {
                    "line-width": 5,
                    // "line-color": flight_layer_color
                    "line-color": ["interpolate", ["linear"], ["/", ["get", "coords_index"], ["get", "coords_total"]], 0, "#ff00ff", 1, "#ff9900"],
                }
            });
            style["layers"].push({
                "id": "3D_flights_" + flight_filename + (flight_filename.split("_").length === 1 ? "_default" : ""),
                "type": "fill-extrusion",
                "source": flight_filename + "_source",
                "filter": ["all", ["==", ["geometry-type"], "Polygon"], ["case", ["has", "name"], ["==", -1, ["index-of", "geofence", ["downcase", ["get", "name"]]]], true]],
                "minzoom": 6,
                "maxzoom": 22,
                "layout": {
                    "visibility": "none"
                },
                "paint": {
                    // "fill-extrusion-color": flight_layer_color,
                    "fill-extrusion-color": ["interpolate", ["linear"], ["/", ["get", "coords_index"], ["get", "coords_total"]], 0, "#ff00ff", 1, "#ff9900"],
                    "fill-extrusion-opacity": 0.4,
                    "fill-extrusion-base": 0,
                    "fill-extrusion-height": ["to-number", ["get", "altitude_m"]]
                }
            });

            // Add a layer for points on the 3D display
            style["layers"].push({
                "id": "3D_flights_" + flight_filename + (flight_filename.split("_").length === 1 ? "_default" : "") + "_points",
                "type": "circle",
                "source": flight_filename + "_source",
                "filter": ["==", ["geometry-type"], "Point"],
                "paint": {
                    "circle-radius": 6,
                    "circle-color": "#ffffff",
                    "circle-opacity": 1,
                    "circle-stroke-width": 6,
                    "circle-stroke-color": "#00ff2a",
                    "circle-stroke-opacity": 1
                }
            });
        }

    } catch(error) {
        console.error(error.message);
        return null;
    }
}



/**
 * init_BalloonFlightsMap - 
 * @param {string} container_id : HTML ID of the container to store the prediction map in
 */
async function init_BalloonFlightsMap(container_id){
    // Initialize the base map style and layers
    let map_style = await BalloonBaseMap.init_base_map_layers();

    // Initialize flight layers
    await init_flights_layers(map_style, layer_defs);

    // Bodge to turn off TFR airspace by default
    // TODO: rework how all these layer definitions work to be better
    layer_defs["Reference"].forEach((layer, index) => {
        if(layer["id"] === "tfr"){
            layer_defs["Reference"][index]["visible"] = false;
        }
    });

    // Create a layer switcher and initialize layer visibility
    let layer_switcher_obj = BalloonBaseMap.create_layer_switcher(map_style, layer_defs, ["Basemap", "Reference", "Flights"]);
    layer_switcher = layer_switcher_obj["layer_switcher"];

    // Create the maplibre-gl map in the given container div
    map = BalloonBaseMap.create_BalloonBaseMap(container_id, map_style, layer_switcher);

    // Create a TerraDraw drawing control
    let draw_control = BalloonBaseMap.create_map_drawing_control(container_id, map);

    // Set layers in the "Reference" group to show their properties when clicked
    BalloonBaseMap.set_show_props_on_click(map, layer_defs, ["Reference", "Flights"]);

    return {
        "map": map,
        "map_style": map_style,
        "layer_switcher": layer_switcher,
        "draw_control": draw_control
    };
}


export default init_BalloonFlightsMap
export {
    init_BalloonFlightsMap,
    init_flights_layers,
    layer_defs,
    visible_flights_data
}