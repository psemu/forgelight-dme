#!/usr/bin/env node

var DME = require("./dme.js"),
    Jenkins = require("jenkins-hash"),
    xml2js = require("xml2js"),
    fs = require("fs"),
    path = require("path");

function usage() {
    console.log("Usage: ./dme.js <mode> <inPath> [<outPath>]");
}


function toJSON(dme) {
    var model = {
        "metadata": { "formatVersion" : 3 },    

        "materials": [ {
            "DbgColor" : 15658734, // => 0xeeeeee
            "DbgIndex" : 0,
            "DbgName" : "dummy",
            "colorDiffuse" : [ 1, 0, 0 ],
        }],

        "vertices": [],
        "uvs":      [[]],
        "faces": []
    };

    var mesh = dme.meshes[0];
    for (var j=0,l=mesh.vertices.length;j<l;j++) {
        var vertex = mesh.vertices[j];
        model.vertices.push(
            vertex[0],
            vertex[1],
            vertex[2]
        );
    }
    var uvs = mesh.uvs[0];
    for (var j=0,l=uvs.length;j<l;j++) {
        var uv = uvs[j];
        model.uvs[0].push(
            uv[0], uv[1]
        );
    }
    for (var j=0,l=mesh.indices.length;j<l;j+=3) {
        model.faces.push(
            10,
            mesh.indices[j],
            mesh.indices[j+1],
            mesh.indices[j+2],
            0,
            mesh.indices[j],
            mesh.indices[j+1],
            mesh.indices[j+2]
        );
    }
    return model;
}


function toOBJ(dme) {
    var obj = [];
    for (var i=0;i<dme.meshes.length;i++) {
        var mesh = dme.meshes[i];
        for (var j=0,l=mesh.vertices.length;j<l;j++) {
            var vertex = mesh.vertices[j];
            obj.push(
                "v " + vertex[0] + " " + vertex[1] + " " + vertex[2]
            );
        }
        for (var j=0,l=mesh.normals.length;j<l;j++) {
            var normal = mesh.normals[j];
            obj.push(
                "vn " + normal[0] + " " + normal[1] + " " + normal[2]
            );
        }
        var uvs = mesh.uvs[0];
        for (var j=0,l=uvs.length;j<l;j++) {
            var uv = uvs[j];
            obj.push(
                "vt " + uv[0] + " " + uv[1]
            );
        }
        for (var j=0,l=mesh.indices.length;j<l;j+=3) {
            var v0 = mesh.indices[j] + 1,
                v1 = mesh.indices[j+1] + 1,
                v2 = mesh.indices[j+2] + 1;
            obj.push(
                "f " + 
                    v1 + "/" + v1 + " " + 
                    v0 + "/" + v0 + " " + 
                    v2 + "/" + v2
            );
        }
    }
    return obj.join("\n");
}


    
var mode = process.argv[2],
    inPath = process.argv[3];

if (inPath) {
    if (!fs.existsSync(inPath)) {
        throw "inPath does not exist";
    }

    switch (mode) {
        case "obj":
            console.log("Reading DME data from " + inPath);
            var data = fs.readFileSync(inPath),
                dme = DME.read(data),
                outPath = process.argv[4],
                obj = [];

            if (!outPath) {
                outPath = "./";
            }
            if (!fs.existsSync(outPath)) {
                throw "outPath does not exist";
            }

            var obj = toOBJ(dme);

            var objPath = path.join(outPath, path.basename(inPath, ".dme") + ".obj");
            console.log("Writing OBJ data to " + objPath);
            fs.writeFileSync(objPath, obj);
            break;
        case "json":
            console.log("Reading DME data from " + inPath);
            var data = fs.readFileSync(inPath),
                dme = DME.read(data),
                outPath = process.argv[4],
                obj = [];

            if (!outPath) {
                outPath = "./";
            }
            if (!fs.existsSync(outPath)) {
                throw "outPath does not exist";
            }

            var obj = toJSON(dme);

            var objPath = path.join(outPath, path.basename(inPath, ".dme") + ".json");
            console.log("Writing JSON data to " + objPath);
            fs.writeFileSync(objPath, JSON.stringify(obj, null, 4));
            break;
        case "info":
            console.log("Reading DME data from " + inPath);
            var data = fs.readFileSync(inPath),
                dme = DME.read(data);

            for (var i=0;i<dme.meshes.length;i++) {
                var mesh = dme.meshes[i];
                console.log("Vertices: " + mesh.vertices.length);
                for (var j=0;j<mesh.drawCalls.length;j++) {
                    console.log("Drawcall: " + mesh.drawCalls[j].vertexCount + " vertices, " + mesh.drawCalls[j].indexCount + " indices");
                }
            }
            //console.log(JSON.stringify(dme, null, 2));


            break;
        case "matdef":
            console.log("Reading material definitions from " + inPath);
            var data = fs.readFileSync(inPath),
                outPath = process.argv[4];
                
            if (!outPath) {
                outPath = path.basename(inPath, ".xml") + "js";
            }

            xml2js.parseString(data.toString("utf-8"), function(err, result) {
                console.log("Writing material definitions to " + outPath);

                var inputLayouts = {},
                    materialDefinitions = {},
                    nodes = result.Object.Array,
                    obj;
                for (var i=0;i<nodes.length;i++) {
                    if (nodes[i].$.Name == "InputLayouts") {
                        var inputLayoutNodes = nodes[i].Object;
                        for (var j=0;j<inputLayoutNodes.length;j++) {
                            var layout = {
                                name: inputLayoutNodes[j].$.Name,
                                entries: []
                            };
                            var entryNodes = inputLayoutNodes[j].Array[0].Object;
                            for (var k=0;k<entryNodes.length;k++) {
                                var entry = {
                                    stream: +entryNodes[k].$.Stream,
                                    type: entryNodes[k].$.Type,
                                    usage: entryNodes[k].$.Usage,
                                    usageIndex: +entryNodes[k].$.UsageIndex
                                };
                                layout.entries.push(entry);
                            }
                            inputLayouts[Jenkins.oaat(layout.name)] = layout;
                        }
                    } else if (nodes[i].$.Name == "MaterialDefinitions") {
                        var matDefNodes = nodes[i].Object;
                        for (var j=0;j<matDefNodes.length;j++) {
                            var matDef = {
                                name: matDefNodes[j].$.Name,
                                hash: Jenkins.oaat(matDefNodes[j].$.Name),
                                drawStyles: []
                            };
                            if (matDefNodes[j].Array) {
                                for (var n=0;n<matDefNodes[j].Array.length;n++) {
                                    if (matDefNodes[j].Array[n].$.Name == "DrawStyles") {
                                        var drawStyleNodes = matDefNodes[j].Array[n].Object;
                                        for (var k=0;k<drawStyleNodes.length;k++) {
                                            var drawStyle = {
                                                name: drawStyleNodes[k].$.Name,
                                                hash: Jenkins.oaat(drawStyleNodes[k].$.Name),
                                                inputLayout: drawStyleNodes[k].$.InputLayout
                                            };
                                            matDef.drawStyles.push(drawStyle);
                                        }
                                    }
                                }
                                materialDefinitions[Jenkins.oaat(matDef.name)] = matDef;
                            }
                        }
                    }
                }

                var obj = {
                    inputLayouts: inputLayouts,
                    materialDefinitions: materialDefinitions
                };

                fs.writeFileSync(outPath, [
                    "var data = " + JSON.stringify(obj, null, 4) + ";",
                    "exports.InputLayouts = data.inputLayouts;",
                    "exports.MaterialDefinitions = data.materialDefinitions;"
                ].join("\n"));
            });

            

            break;
        default:
            usage();
    }
} else {
    usage();
}




