const port = process.env.PORT || 4000;
const express = require("express");

const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { type } = require("os");

app.use(express.json());
app.use(cors());

//database connetion with mongodb
mongoose.connect("mongodb://localhost:27017/cuong");

//api creation

app.get("/", (req, res) => {
    res.send("Express app is running");
})

//image storage engine
const storage = multer.diskStorage({
    destination: './upload/images',
    filename: (req,file,cb)=>{
        return cb(null,`${file.freename}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({storage:storage})

//creating upload endpoint for images
app.use('/images', express.static('./upload/images'))

app.post("/upload", upload.single('product'),(req,res)=>{
    res.json({
        success:1, 
        image_url: `http://localhost:${port}/images/${req.file.filename}`
    })
})

// schema for creating products
const Product = mongoose.model("Product", {
    id:{
        type: Number,
        require: true,
    },
    name:{
        type: String,
        require: true,
    },
    image:{
        type: String,
        require: true,
    },
    category:{
        type: String,
        require: true,
    },
    new_price:{
        type: Number,
        require: true,
    }, 
    old_price:{
        type: Number,
        require: true,
    },
    date:{
        type: Date,
        default: Date.now
    },
    available:{
        type: Boolean,
        default: true,
    },
})

app.post('/addproduct', async (req, res) => {
    try {
        let products = await Product.find({}).sort({id: -1}); // Sắp xếp theo id giảm dần
        let id = 1; // Giá trị mặc định cho id

        if (products.length > 0) {
            let last_product = products[0]; // Lấy sản phẩm có id lớn nhất
            id = last_product.id + 1; // Tăng id thêm 1
        }

        // Tạo sản phẩm mới với id mới
        const product = new Product({
            id: id,
            name: req.body.name,
            image: req.body.image,
            category: req.body.category,
            new_price: req.body.new_price,
            old_price: req.body.old_price,
        });

        console.log(product);
        await product.save();
        console.log("Saved");

        res.json({
            success: true,
            name: req.body.name,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "An error occurred",
        });
    }
});

//creating api for deleting products
app.post('/removeproduct', async (req, res)=>{
    await Product.findOneAndDelete({id:req.body.id});
    console.log("Removed");
    res.json({
        success:true,
        name:req.body.name
    })
}) 

//creating api for getting all products
app.get('/allproducts', async(req, res)=>{
    let products = await Product.find({});
    console.log("All product fetched");
    res.send(products);
})

//Schema creating for User model
const Users = mongoose.model('Users', {
    name:{
        type:String,
    },
    email:{
        type:String,
        unique:true
    },
    password:{
        type:String,
    },
    cartData:{
        type:Object,
    },
    date:{
        type:Date, 
        default:Date.now,
    }
})

//Creating end point for registering the user
app.post('/signup', async (req, res) => {
    try {
        // Chuyển email về chữ thường để kiểm tra
        const email = req.body.email.toLowerCase();

        // Kiểm tra xem email đã tồn tại trong cơ sở dữ liệu hay chưa
        let check = await Users.findOne({ email: email });
        if (check) {
            return res.status(400).json({ success: false, errors: "Existing user found with same email address" });
        }

        // Khởi tạo giỏ hàng trống
        let cart = {};
        for (let i = 0; i < 300; i++) {
           cart[i] = 0;
        }

        // Tạo đối tượng user mới
        const user = new Users({
            name: req.body.name,  // Sử dụng 'name' thay vì 'username'
            email: email,
            password: req.body.password,
            cartData: cart,
        });

        // Lưu user vào cơ sở dữ liệu
        await user.save();

        // Tạo token JWT
        const data = {
            user: {
                id: user.id
            }
        };

        const token = jwt.sign(data, 'secret_ecom');

        // Trả về token cho client
        res.json({ success: true, token });
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ success: false, errors: "Server error" });
    }
});

//creating endpoint for user login
app.post('/login', async (req, res)=>{
    let user = await Users.findOne({email:req.body.email});
    if(user)
        {   
            const passCompare = req.body.password === user.password;
            if(passCompare){
                const data = {
                    user:{
                        id: user.id
                    }
                }
                const token = jwt.sign(data, 'secret_ecom');
                res.json({success:true,token})
            }
            else {
                res.json({success:false, errors:"Wrong password"});
            }
        } else {
            res.json({success:false, errors:"Wrong email id"});
        }
})

//create endpoint for new collection data
app.get('/newcollections', async(req, res)=>{
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("NewCollection fetched");
    res.send(newcollection);
})

//create endpoint for popular in women section
app.get('/popularinwomen', async(req, res)=>{
    let products = await Product.find({category:"women"});
    let popular_in_women = products.slice(0,4);
    console.log("Popular in women fetched");
    res.send(popular_in_women);
})

//creating middleware to fetch user 
const fetchUser = async (req,res,next) => {
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({errors:"Please authenticate using a valid token"});
    }
    else {
        try {
            const data = jwt.verify(token,'secret_ecom');
            req.user = data.user;
            next();
        } catch (error) {
            res.status(401).send({errors:"Please authenticate using a valid token"})
        }
    }
}

//creating endpoint for adding products in cartdata
app.post('/addtocart',fetchUser, async(req, res)=>{
    console.log("added", req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id});
    userData.cartData[req.body.itemId] += 1;
    await Users.findOneAndUpdate({_id:req.user.id}, {cartData:userData.cartData});
    res.send("Added")
})

//creating endpoint to remove product from cartdata
app.post('/removefromcart',fetchUser, async(req, res)=>{
    console.log("removed", req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id});
    if( userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1;
    await Users.findOneAndUpdate({_id:req.user.id}, {cartData:userData.cartData});
    res.send("Removed");
})

//creating endpoint to get cartdata
app.post('/getcart',fetchUser, async(req, res)=>{
    console.log("getcart");
    let userData = await Users.findOne({_id:req.user.id});
    res.json(userData.cartData);
})


app.listen(port,(error)=>{
    if(!error)
    {
        console.log("Server is running on port " + port);
    }
    else
    {
        console.log("Error" + error);
    }
})
