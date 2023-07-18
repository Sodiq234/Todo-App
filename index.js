require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT;
const Joi = require('joi');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const sgMail = require('@sendgrid/mail');
const { v4: uuidv4 } = require('uuid');
var bodyParser = require('body-parser')
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
app.use(bodyParser.json());



const userStore =[];
const otpStore =[];
const todoStore =[];


app.get('/' , (req,res) => {
    res.status(200).json({
        status: true,
        message: "Welcome to my mini todo app. We are here to help you keep events"
    })
})

app.post('/signup', async (req,res) => {

    const { title, firstname, lastname, email, password } = req.body;

    const signUpSchema = Joi.object({
        title: Joi.string().required().valid('Mr','Mrs','Miss'),
        firstname: Joi.string().required(),
        lastname: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().required()
    });
    
    const { value , error } = signUpSchema.validate(req.body);

    if (error !== undefined){
        res.status(400).json({
        status: false,
        message: error.details[0].message
        })
    return
    };

    const responseSalt = await bcrypt.genSalt(saltRounds);
    if (!responseSalt){
        res.status(400).json({
        status: false,
        message: error.details[0].message
        })
    return
    };

    const responseHash = await bcrypt.hash(password, responseSalt);

    if (!responseHash){
        res.status(400).json({
        status: false,
        message: error.details[0].message
        })
    return
    };

    const tempUser = {
        title,
        firstname,
        lastname,
        email,
        salt: responseSalt,
        password: responseHash,
        status: 'inactive',
        date: new Date()
    };

    userStore.push(tempUser);

    const otp = generateOtp();

    const tempOtp = {
        otpId: uuidv4(),
        email,
        otp,
        date: new Date()
    };

    otpStore.push(tempOtp)

    sendEmail(email, 'OTP Verification', `Hello ${firstname}, Kindly use this otp ${otp} to finish your application`);

    res.status(200).json({
        status: true,
        message: 'Kindly use the OTP to verify your account for complete account craetion.'
    })
});

app.get('/verify-otp/:email/:otp', (req,res) => {

    const { email, otp } = req.params;

    if ( !email || !otp ){
        res.status(400).json({
            status: false,
            message: 'Email and OTP are required'
        })
        return
    };

    const userExist = otpStore.find(item => item.email === email && item.otp === parseInt(otp) )

    if ( !userExist){
        res.status(400).json({
            status: false,
            message: 'Invalid Email or OTP'
        })
        return
    };

    const timeDifference = new Date() - new Date(userExist.date)
    const timeDifferenceInMinutes = Math.ceil(timeDifference/(1000 * 60));

    if ( timeDifferenceInMinutes > 2 ){
        res.status(400).json({
            status: false,
            message: 'OTP has expired'
        })
        return  
    };

    const statusUpdate = userStore.find(item => item.email === email)
    statusUpdate.status = 'active'

    sendEmail( email, 'Account Confirmation', 'Hello, your account has been successfully confirmed. Once again welcome' );

    res.status(200).json({
        status: true,
        message: 'Sign up has been done successfully.',
        data: userStore
    });
});


app.get('/resend-otp/:email', (req,res) => {

    const email = req.params.email;

    if (!email){
        res.status(200).json({
            status: false,
            message: 'Email is required'
        })
        return
    };

    const emailExist = userStore.find(item => item.email === email);

    if (!emailExist){
        res.status(200).json({
            status: false,
            message: 'Email does not exist'
        })
        return
    };

    const otp = generateOtp();

    const tempOtp = {
        otpId: uuidv4(),
        email,
        otp,
        date: new Date()
    };

    otpStore.push(tempOtp);

    sendEmail (email, 'OTP resend', 'Hello, an OTP has been resent to you for your account confirmation.');

    res.status(200).json({
        status: true,
        message: 'An OTP has been resent.'
    });
});

app.post('/login', async (req,res) => {

    const { email, password } = req.body;

    const loginSchema = Joi.object({
        email: Joi.string().email().required(),
        password : Joi.string().required()
    });

    const { value, error } = loginSchema.validate(req.body);

    if( error !== undefined ){
        res.status(400).json({
            status: true,
            message: error.details[0].message
        })
        return
    };

    const emailExist = userStore.find(item => item.email === email);
    if(!emailExist){
        res.status(400).json({
            status: false,
            message: 'User does not exist'
        })
        return
    };

    const newHash = await bcrypt.hash(password, emailExist.salt)

    if ( newHash !== emailExist.password){
        res.status(400).json({
            status: false,
            message: 'Invalid password'
        })
        return
    };

    res.status(200).json({
        status: true,
        message: 'You are logged in'
    })
})





// Helpers function

const generateOtp = () => {
    return Math.floor(10000 + Math.random()*90000)
};

const sendEmail = (email, subject, message) => {
    const msg = {
        to: email,
        from: process.env.SENDER_EMAIL, 
        subject: subject,
        text: message
      };
      sgMail
        .send(msg)
        .then(() => {})
        .catch((error) => {})

}

app.listen(PORT, () => {
    console.log(`We are listing on port: ${PORT}`)
})