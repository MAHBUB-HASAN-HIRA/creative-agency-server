const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const fileUpload = require('express-fileupload');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(fileUpload());

const dbInfo = {
    DB_USER: process.env.DB_USER,
    DB_PASS: process.env.DB_PASS,
    DB_NAME: process.env.DB_NAME,
    FIREBASE_DB_URL: process.env.FIREBASE_DB_URL,
};


const serviceAccount = require("./creative-agency-101-firebase-adminsdk-djbge-2049716dc1.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `${dbInfo.FIREBASE_DB_URL}`
});


const uri = `mongodb+srv://${dbInfo.DB_USER}:${dbInfo.DB_PASS}@creativeagency101.3zdio.mongodb.net/${dbInfo.DB_NAME}?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });  

    client.connect(err => {
      const adminCollection = client.db(`${dbInfo.DB_NAME}`).collection("Admin");
      const orderCollection = client.db(`${dbInfo.DB_NAME}`).collection("order");
      const servicesCollection = client.db(`${dbInfo.DB_NAME}`).collection("Services");
      const reviewCollection = client.db(`${dbInfo.DB_NAME}`).collection("review");

  //  Decode email From JWT Token
    const checkTokenEmail = token => {
        if(token && token.startsWith('Bearer ')){
            const idToken = token.split(' ')[1];
            return admin.auth().verifyIdToken(idToken)
            .then(decodedToken => decodedToken.email);
        };
    };


    //  post Customer review to reviewCollection database
    app.post('/review', (req, res) =>{
        const queryEmail = req.query.email
        const tokenEmail = checkTokenEmail(req.headers.authorization);
        tokenEmail.then(decodeEmail =>{
            if(decodeEmail === queryEmail){
                reviewCollection.insertOne(req.body)
                .then(result => {
                    if(result){
                        res.send(result.insertedCount > 0);
                    }   
                });
            }
            else{
                res.status(401).send('unauthorized access');
            }
        });
       
    });

    //get all customer review from reviewCollection database
    app.get('/getReview', (req, res) => {
        reviewCollection.find()
        .toArray((err, documents) => {
            if(documents){
                res.send(documents);
            }
        });
    });

    //  post an addOrder from customer to orderCollection database
    app.post('/addOrder', (req, res) => {
        let image;
        if(req.files){
            file = req.files.file;
            const newImg = file.data;
            const encImg = newImg.toString('base64');
            image = {
                contentType: file.mimetype,
                size: file.size,
                img: Buffer.from(encImg, 'base64')
            };
        };
        if(req.body.file){
            const imageFile = JSON.parse(req.body.file);
            image = {
                contentType:imageFile.contentType,
                size: imageFile.size,
                img: imageFile.img,
            };
        };
        const name = req.body.name;
        const userEmail = req.body.userEmail;
        const orderEmail = req.body.orderEmail;
        const service = req.body.service;
        const message = req.body.message;
        const price = req.body.price;
        const status = req.body.status;
        
        if(image){
            orderCollection.insertOne({ name, userEmail, orderEmail, message, service, price, status, image })
            .then(result => {
                res.send(result.insertedCount > 0);
            });
        };
    });

//get serviceList from database with pacific email and Check security by jwt token
app.get('/serviceList', (req, res) =>{
    const queryEmail = req.query.email;
    const tokenEmail = checkTokenEmail(req.headers.authorization);
    tokenEmail.then(decodeEmail =>{
        if(decodeEmail === queryEmail){
            adminCollection.find({adminEmail: decodeEmail})
            .toArray((err, documents) => {
                if(documents.length){
                    orderCollection.find()
                    .toArray((err, results) => {
                        if(results){
                            res.status(200).send(results);
                        }; 
                    });
                };
                if(documents.length == 0){
                    orderCollection.find({userEmail: decodeEmail})
                    .toArray((err, result) => {
                        if(result){
                            res.status(200).send(result);
                        }   
                    });
                }
            });
        }
        else{
            res.status(401).send('unauthorized access');
        };
    }).catch(function(error) {
        res.status(401).send('unauthorized access');
    });
});

 
    //  make an admin by email and send data to adminCollection database
    app.post('/makeAdmin', (req, res) =>{
        const queryEmail = req.query.email
        const tokenEmail = checkTokenEmail(req.headers.authorization);
        tokenEmail.then(decodeEmail =>{
            if(decodeEmail === queryEmail){
                adminCollection.find({adminEmail: decodeEmail})
                .toArray((err, documents) => {
                    if(documents.length){
                        adminCollection.insertOne(req.body)
                        .then(result => {
                            if(result.insertedCount){
                                res.send(result.insertedCount > 0);
                            }
                            else{
                                res.status(401).send('unauthorized access');
                            };
                        });
                    }
                    else{
                        res.status(401).send('unauthorized access');
                    };
                });
            }
            else{
                res.status(401).send('unauthorized access');
            };
        });
    });


    //  post a service by admin to serviceCollection database
    app.post('/addService', (req, res) => {
        const queryEmail = req.query.email
        const file = req.files.file;
        const title = req.body.title;
        const description = req.body.description;
        const price = req.body.price;
        const newImg = file.data;
        const encImg = newImg.toString('base64');
       
        var image = {
            contentType: file.mimetype,
            size: file.size,
            img: Buffer.from(encImg, 'base64')
        };


        const tokenEmail = checkTokenEmail(req.headers.authorization);
        tokenEmail.then(decodeEmail =>{
            if(decodeEmail === queryEmail){
                adminCollection.find({adminEmail: decodeEmail})
                .toArray((err, documents) => {
                    if(documents.length){
                        servicesCollection.insertOne({ title, description, price, image })
                        .then(result => {
                            res.send(result.insertedCount > 0);
                        });
                    }
                    else{
                        res.status(401).send('unauthorized access');
                    };
                });
            }
            else{
                res.status(401).send('unauthorized access');
            };
        });
    });

    //get all service from serviceCollection database 
    app.get('/services', (req, res) => {
        servicesCollection.find()
        .toArray((err, documents) => {
            if(documents){
                res.send(documents);
            }
        });
    });

    //update order status by admin 
    app.patch('/updateStatus', (req, res) =>{
        const id = req.body.id;
        const currentStatus = req.body.status;
        const queryEmail = req.query.email
        const tokenEmail = checkTokenEmail(req.headers.authorization);
        tokenEmail.then(decodeEmail =>{
            if(decodeEmail === queryEmail){
                adminCollection.find({adminEmail: decodeEmail})
                .toArray((err, documents) => {
                    if(documents.length){
                        orderCollection.updateOne({_id: ObjectID(id)},
                        {
                            $set:{status: currentStatus}
                        }
                        ).then(result =>{
                            res.send(result.matchedCount > 0);
                        });
                    };
                });
            };
        });
    });

    
    //check isAdmin or not
    app.get('/isAdmin', (req, res) => {
        adminCollection.find({adminEmail:req.query.email})
        .toArray((err, documents) => {
            if(documents.length){
                res.send(documents.length > 0);
            }
        });
    });



});


app.get('/', (req, res) => {
    res.send('Hello World!')
    })

app.listen( process.env.PORT || 5000);
