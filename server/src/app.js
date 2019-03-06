const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const morgan = require('morgan')
const axios = require('axios')
const CircularJSON = require('circular-json')
const querystring = require("querystring")
const CryptoJS = require("crypto-js")
var cryptoKey = "doraemon"
// const json2csv = require('json2csv').parse
const Json2csvParser = require('json2csv').Parser;
var iconvLite = require('iconv-lite');

// https://momentjs.com/docs/
const moment = require('moment')

var http = require('http'),
    fs = require('fs')

axios.defaults.timeout = 200000;

var port1 = 6081

var app = express()
app.use(morgan('combined'))
// https://github.com/apostrophecms/apostrophe/issues/1291
app.use(bodyParser.json({limit: "500mb", extended: true}));
app.use(bodyParser.urlencoded({limit: "500mb", extended: true, parameterLimit:50000}));

app.use(cors())

http.createServer(app).listen(port1, function () {
    console.log('Http RestServerForJejuUniv listening on port ' + port1)
})

var mongoose = require('mongoose')
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://park:park**@192.168.66.30:27017/Parking')
var db = mongoose.connection
db.on("error", console.error.bind(console, "connection error"));
db.once("open", function(callback){
  console.log("Connection Succeeded");
});

var ParkingData = require("../models/parkingdata")
// var Bucheon_ParkingData = require("../models/" + "bucheon_parkingdatas")
var dynamicCollectionSchema = null

// https://silvernine.me/wp/?p=943
function getDownloadFilename(req, filename) {
    var header = req.headers['user-agent'];
 
    if (header.includes("MSIE") || header.includes("Trident")) { 
        return encodeURIComponent(filename).replace(/\\+/gi, "%20");
    } else if (header.includes("Chrome")) {
        return iconvLite.decode(iconvLite.encode(filename, "UTF-8"), 'ISO-8859-1');
    } else if (header.includes("Opera")) {
        return iconvLite.decode(iconvLite.encode(filename, "UTF-8"), 'ISO-8859-1');
    } else if (header.includes("Firefox")) {
        return iconvLite.decode(iconvLite.encode(filename, "UTF-8"), 'ISO-8859-1');
    }
 
    return filename;
}

// Fetch parkingdata by parking_id, date
app.get('/getParkingData/:parkingId/:startDate/:endDate', (req, res) => {
    console.log(req.params)
    // console.log(Bucheon_ParkingData)
    ParkingData.find({}, '', function (error, pds) {
        if (error) { console.error(error); }        
        if (pds[0].type === "A") {
            console.log("A Type!")
            dynamicCollectionSchema = require("../models/" + pds[0].parking_data)
            dynamicCollectionSchema.aggregate([                    
                    {
                        "$match" : { "in_time" : { $gte: new Date(req.params.startDate), $lte: new Date(req.params.endDate) } }
                    },
                    {
                        "$project": {
                            car_no: 1,
                            in_time: 1,
                            out_time: 1,
                            parking_time: { "$dateToString": { format: "%Y%m%d%H", date: "$in_time" } }
                        }
                    },
                    {
                    "$lookup": {
                                from: "weatherdatas",
                                let: { parking_date: "$parking_time" },
                                pipeline: [
                                            { 
                                                "$unwind": "$currentData"
                                            },
                                            {
                                                "$project": {
                                                    address: 1,
                                                    currentData: 1,                             
                                                    weatherDate: {  "$concat" : [ "$currentData.weather.baseDate",                                                                                                                          
                                                                                { "$substr": [ "$currentData.weather.baseTime", 0, 2 ] }
                                                                              ] 
                                                                 }                              
                                                          }
                                            },
                                            { "$match":
                                                {
                                                    "$expr": {
                                                                $and : [
                                                                        { $eq: [
                                                                                "$address",                                                                                                   
                                                                                pds[0].parking_address
                                                                               ]
                                                                        },
                                                                        { $eq: [
                                                                                "$weatherDate",                                                                                                   
                                                                                "$$parking_date"
                                                                               ]
                                                                        }
                                                                       ]
                                                           } 
                                                }
                                            }
                                          ],
                                as: "weatherdata"
                             }
                    },
                    {
                        "$unwind": "$weatherdata"
                    },
                    { 
                        "$group": { _id: null,                                                     
                                    parking_data: { "$push": {  car_no: "$car_no",
                                                                in_time: "$in_time",
                                                                out_time: "$out_time",
                                                                t1h: { "$floor" : "$weatherdata.currentData.weather.t1h" },
                                                                reh: "$weatherdata.currentData.weather.reh",
                                                                sky: "$weatherdata.currentData.weather.sky",
                                                                pty: "$weatherdata.currentData.weather.pty",
                                                             } 
                                                  }
                                  }
                    }
                ], function (err, result) {
                    if (err) {
                        next(err);
                    } else {
                        var tmpJsonData = { "parking_id" : pds[0].parking_id, 
                                            "parking_address" : pds[0].parking_address, 
                                            "parking_name" : pds[0].parking_name,
                                            "parking_data" : result[0].parking_data
                                          }
                        res.send(tmpJsonData);
                    }
                })
        } else if (pds[0].type === "B") {
            console.log("B Type!")
            dynamicCollectionSchema = require("../models/" + pds[0].parking_data)
            dynamicCollectionSchema.aggregate([                    
                    {
                        "$match" : { "time" : { $gte: new Date(req.params.startDate), $lte: new Date(req.params.endDate) } }
                    },
                    {
                        "$project": {
                            entrance: 1,
                            time: 1,
                            divide: 1,                            
                            parking_time: { "$dateToString": { format: "%Y%m%d%H", date: "$time" } }
                        }
                    },
                    {
                    "$lookup": {
                                from: "weatherdatas",
                                let: { parking_date: "$parking_time" },
                                pipeline: [
                                            { 
                                                "$unwind": "$currentData"
                                            },
                                            {
                                                "$project": {
                                                    address: 1,
                                                    currentData: 1,                             
                                                    weatherDate: {  "$concat" : [ "$currentData.weather.baseDate",                                                                                                                          
                                                                                { "$substr": [ "$currentData.weather.baseTime", 0, 2 ] }
                                                                              ] 
                                                                 }                              
                                                          }
                                            },
                                            { "$match":
                                                {
                                                    "$expr": {
                                                                $and : [
                                                                        { $eq: [
                                                                                "$address",                                                                                                   
                                                                                pds[0].parking_address
                                                                               ]
                                                                        },
                                                                        { $eq: [
                                                                                "$weatherDate",                                                                                                   
                                                                                "$$parking_date"
                                                                               ]
                                                                        }
                                                                       ]
                                                           }  
                                                }
                                            }
                                          ],
                                as: "weatherdata"
                             }
                    },
                    {
                        $unwind: '$weatherdata'
                    },
                    { 
                        $group: { _id: null,                                                   
                                  parking_data: { "$push": {    entrance: "$entrance",
                                                                time: "$time",
                                                                divide: "$divide",
                                                                t1h: { "$floor" : "$weatherdata.currentData.weather.t1h" },
                                                                reh: "$weatherdata.currentData.weather.reh",
                                                                sky: "$weatherdata.currentData.weather.sky",
                                                                pty: "$weatherdata.currentData.weather.pty",
                                                           } 
                                                }
                                }
                    }
                ], function (err, result) {
                    if (err) {
                        next(err);
                    } else {
                        var tmpJsonData = { "parking_id" : pds[0].parking_id, 
                                            "parking_address" : pds[0].parking_address, 
                                            "parking_name" : pds[0].parking_name,
                                            "parking_data" : result[0].parking_data
                                          }
                        res.send(tmpJsonData);
                    }
                })
        }        
        // console.log(pds[0].type)
        // res.send(pds)
    })
    .where('parking_id').equals(req.params.parkingId)
})

app.get("/getCSV/:parkingId/:startDate/:endDate", function (req, res) {
    /*
    var fields = ['car', 'price', 'color'];
    var myCars = [
      {
        "car": "Audi",
        "price": 1,
        "color": "blue"
      }, {
        "car": "BMW",
        "price": 1,
        "color": "black"
      }, {
        "car": "Porsche",
        "price": 1,
        "color": "green"
      }
    ];
    const json2csvParser = new Json2csvParser({ fields });
    const csv = json2csvParser.parse(myCars);
    console.log(csv);
    */
    req.setTimeout(0) // no timeout

    ParkingData.find({}, {parking_id:1, parking_address:1, parking_name:1, type:1, parking_data:1}, function (error, pds) {
        if (error) { console.error(error); }        
        if (pds[0].type === "A") {
            console.log("A Type!")
            dynamicCollectionSchema = require("../models/" + pds[0].parking_data)
            dynamicCollectionSchema.aggregate([                    
                    {
                        "$match" : { "in_time" : { $gte: new Date(req.params.startDate), $lte: new Date(req.params.endDate) } }
                    },
                    {
                        "$project": {
                            car_no: 1,
                            in_time: 1,
                            out_time: 1,
                            parking_time: { "$dateToString": { format: "%Y%m%d%H", date: "$in_time" } }
                        }
                    },
                    {
                    "$lookup": {
                                from: "weatherdatas",
                                let: { parking_date: "$parking_time" },
                                pipeline: [
                                            { 
                                                "$unwind": "$currentData"
                                            },
                                            {
                                                "$project": {
                                                    address: 1,
                                                    currentData: 1,                             
                                                    weatherDate: {  "$concat" : [ "$currentData.weather.baseDate",                                                                                                                          
                                                                                { "$substr": [ "$currentData.weather.baseTime", 0, 2 ] }
                                                                              ] 
                                                                 }                              
                                                          }
                                            },
                                            { "$match":
                                                {
                                                    "$expr": {
                                                                $and : [
                                                                        { $eq: [
                                                                                "$address",                                                                                                   
                                                                                pds[0].parking_address
                                                                               ]
                                                                        },
                                                                        { $eq: [
                                                                                "$weatherDate",                                                                                                   
                                                                                "$$parking_date"
                                                                               ]
                                                                        }
                                                                       ]
                                                           } 
                                                }
                                            }
                                          ],
                                as: "weatherdata"
                             }
                    },
                    {
                        "$unwind": "$weatherdata"
                    },
                    { 
                        "$group": { _id: null,                                                     
                                    parking_data: { "$push": {  car_no: "$car_no",
                                                                in_time: "$in_time",
                                                                out_time: "$out_time",
                                                                t1h: { "$floor" : "$weatherdata.currentData.weather.t1h" },
                                                                reh: "$weatherdata.currentData.weather.reh",
                                                                sky: "$weatherdata.currentData.weather.sky",
                                                                pty: "$weatherdata.currentData.weather.pty",
                                                             } 
                                                  }
                                  }
                    }
                ], function (err, result) {
                    if (err) {
                        next(err);
                    } else {
                        // res.send(result);                        
                        var fields = ['car_no', 'in_time', 'out_time', 't1h', 'reh', 'sky', 'pty'];
                        const json2csvParser = new Json2csvParser({ fields, withBOM: true });
                        // console.log(result)
                        const csv = json2csvParser.parse(result[0].parking_data);
                        // console.log(csv);                
                        const filename = pds[0].parking_name + '_' + pds[0].parking_id + '_data.csv'
                        console.log(filename)
                        res.setHeader('Content-disposition', 'attachment; filename=' + getDownloadFilename(req, filename))
                        res.set('Content-Type', 'text/csv; charset=utf-8')
                        res.status(200).send(csv)
                    }
                })
        } else if (pds[0].type === "B") {
            console.log("B Type!")
            dynamicCollectionSchema = require("../models/" + pds[0].parking_data)
            dynamicCollectionSchema.aggregate([                    
                    {
                        "$match" : { "time" : { $gte: new Date(req.params.startDate), $lte: new Date(req.params.endDate) } }
                    },
                    {
                        "$project": {
                            entrance: 1,
                            time: 1,
                            divide: 1,                            
                            parking_time: { "$dateToString": { format: "%Y%m%d%H", date: "$time" } }
                        }
                    },
                    {
                    "$lookup": {
                                from: "weatherdatas",
                                let: { parking_date: "$parking_time" },
                                pipeline: [
                                            { 
                                                "$unwind": "$currentData"
                                            },
                                            {
                                                "$project": {
                                                    address: 1,
                                                    currentData: 1,                             
                                                    weatherDate: {  "$concat" : [ "$currentData.weather.baseDate",                                                                                                                          
                                                                                { "$substr": [ "$currentData.weather.baseTime", 0, 2 ] }
                                                                              ] 
                                                                 }                              
                                                          }
                                            },
                                            { "$match":
                                                {
                                                    "$expr": {
                                                                $and : [
                                                                        { $eq: [
                                                                                "$address",                                                                                                   
                                                                                pds[0].parking_address
                                                                               ]
                                                                        },
                                                                        { $eq: [
                                                                                "$weatherDate",                                                                                                   
                                                                                "$$parking_date"
                                                                               ]
                                                                        }
                                                                       ]
                                                           }  
                                                }
                                            }
                                          ],
                                as: "weatherdata"
                             }
                    },
                    {
                        $unwind: '$weatherdata'
                    },
                    { 
                        $group: { _id: null,                                                   
                                  parking_data: { "$push": {    entrance: "$entrance",
                                                                time: "$time",
                                                                divide: "$divide",
                                                                t1h: { "$floor" : "$weatherdata.currentData.weather.t1h" },
                                                                reh: "$weatherdata.currentData.weather.reh",
                                                                sky: "$weatherdata.currentData.weather.sky",
                                                                pty: "$weatherdata.currentData.weather.pty",
                                                           } 
                                                }
                                }
                    }
                ], function (err, result) {
                    if (err) {
                        next(err);
                    } else {
                        // res.send(result);                        
                        var fields = ['entrance', 'time', 'divide', 't1h', 'reh', 'sky', 'pty'];
                        const json2csvParser = new Json2csvParser({ fields, withBOM: true });
                        // console.log(result)
                        const csv = json2csvParser.parse(result[0].parking_data);
                        // console.log(csv);                
                        const filename = pds[0].parking_name + '_' + pds[0].parking_id + '_data.csv'
                        console.log(filename)
                        res.setHeader('Content-disposition', 'attachment; filename=' + getDownloadFilename(req, filename))
                        res.set('Content-Type', 'text/csv; charset=utf-8')
                        res.status(200).send(csv)
                    }
                })
        }        
        // console.log(pds[0].type)
        // res.send(pds)
    })
    .where('parking_id').equals(req.params.parkingId)
});