const express = require('express')
const app = express()
var cors = require('cors')
require('dotenv').config()
const multer = require('multer');
var jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 3000



app.use(express.json())
app.use(cors({
  origin:["http://localhost:5173","https://findlostitem-1ef05.web.app","https://findlostitem-1ef05.firebaseapp.com","http://localhost:5174"],
  credentials:true
}))

app.use(cookieParser());

let varifyToken=(req,res,next)=>{
  // console.log("middleware running")

  let token =req.cookies?.token
  // console.log(token)



  // lostUser
  // BQfmibKTAR4FdMq9

  if(!token){
    return res.status(401).send({message:"unauthorized token"})
  }


  jwt.verify(token, process.env.JWT_Secret,(err, decoded)=>{

    if(err){
      return res.status(401).send({message:"unauthorized token"})
    }

    req.user=decoded
    next()
  });
  

  

}


app.get('/', (req, res) => {
  res.send('Hello World!')
})



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_Pass}@cluster0.bnqcs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const database = client.db('lostFoundDB');
  const itemsCollection = database.collection('itemsCollection');
  const recoveredData = database.collection('recoveredData');


  app.post("/jwt",async(req,res)=>{
      

    let userData=req.body

    let token= jwt.sign(userData, process.env.JWT_Secret, { expiresIn: "1h" });

    res
    .cookie('token', token, {
      httpOnly: true, 
      // secure:false  ,    // Prevent JavaScript access to the cookie
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",         // Send cookie over HTTPS only
      
  })
    .send({success:true})
    
  });

  app.post("/logout",(req,res)=>{
    res
    .clearCookie('token',  {
      httpOnly: true,
      // secure:false,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict", // Use true in production with HTTPS
    })
    .send({success:true})
  })


  app.post("/addItems",varifyToken,async(req,res)=>{
    let data=req.body
    

    const result = await itemsCollection.insertOne(data);
    res.send(result)
      

  })

  app.get("/allItems",async(req,res)=>{

    let page=parseInt(req.query.page)
      let size=parseInt(req.query.size)


    // const cursor = itemsCollection.find();
    // let result= await cursor.toArray()
    // res.send(result)
    const result = await itemsCollection.find()
        .skip(page*size) // Skip previous pages
         .limit(size) 
        .toArray();
        res.send(result);


  })

  app.get("/items/:id",varifyToken,async(req,res)=>{

    let idx=req.params.id
    let query={_id:new ObjectId(idx)}
    const result = await itemsCollection.findOne(query);
    res.send(result)

  })

  app.post("/recovered-items",varifyToken,async(req,res)=>{

    let data=req.body
    let email= data.recoveredBy.email
    let itemId=data.itemId
    // console.log(email,itemId)

    let query={email,itemId}

    let existingData=await recoveredData.findOne(query);
 

    if (existingData) {
        // If an existing request is found, send it to the client
        return res.send(existingData);
       
    }
    // console.log(existingData)
     // If no existing request, insert the form data into bitCollection
     const result = await recoveredData.insertOne(data);

         // Update status
    let filter = { _id: new ObjectId(itemId) };
    const updateDoc = {
        $set: {
          status: "recovered"
        },
      };
  

    await itemsCollection.updateOne(filter, updateDoc);

   res.send(result)
  })

//   http://localhost:3000/items?limit=6&sort=desc

  // GET request to fetch the latest 6 items
 app.get("/items", async (req, res) => {
    const { limit = 6, sort = 'desc' } = req.query; // Default limit to 6 and sort by descending
  
    try {
      const items = await itemsCollection
        .find({postType:"Lost"})
        .sort({ dateLost: sort === 'desc' ? -1 : 1 }) // Sort by dateLost in descending order (most recent first)
        .limit(parseInt(limit)) // Limit the results to 6
        .toArray();
  
      res.json(items);
    } catch (error) {
      console.error('Error fetching items:', error);
      res.status(500).send('Server error');
    }
  });


  app.get("/myItems/:email",varifyToken,async(req,res)=>{

    let email=req.params.email
    const query = {email};
    const cursor = itemsCollection.find(query);

    let result=await cursor.toArray()
    res.send(result)

  })

  app.delete("/myItems/:id",varifyToken,async(req,res)=>{
    let idx=req.params.id
    const query = { _id: new ObjectId(idx) };
    const result = await itemsCollection.deleteOne(query);
    res.send(result)
  })

  // Update item by ID
app.put('/updateItems/:id', varifyToken,async(req, res) => {

  let idx=req.params.id
  const { postType, thumbnail, title, description, category, location, dateLost } = req.body;

  const filter = { _id: new ObjectId(idx) };

  const updateDoc = {
    
       $set: { 
        postType, thumbnail, title, description, category, location, dateLost: new Date(dateLost)
       },
    
  };

  const result = await itemsCollection.updateOne(filter, updateDoc);

  res.send(result)
 
});

app.get("/recovered-items/:email",varifyToken,async(req,res)=>{

  let email=req.params.email
  const query = {"recoveredBy.email":email};
  const cursor = recoveredData.find(query);

  let result=await cursor.toArray()
  res.send(result)

})


app.get("/itemCount",async(req,res)=>{

  let count= await itemsCollection.estimatedDocumentCount()

  res.send({count})
})


  






    // // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})