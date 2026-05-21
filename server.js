const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { MongoClient } = require('mongodb'); 

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));
app.use(express.json());

// आपका असली मोंगोडीबी डायरेक्ट कनेक्शन लिंक
const mongoURI = "mongodb+srv://Gaurav123kumar:Gaurav12345@cluster0.3ysbxvk.mongodb.net/gt_game_db?retryWrites=true&w=majority&appName=Cluster0";
let db, usersCollection;

MongoClient.connect(mongoURI)
    .then(client => {
        db = client.db('gt_game_db');
        usersCollection = db.collection('users');
        console.log("MongoDB Database Connected Successfully! 🎉");
    })
    .catch(err => console.error("Database Connection Failed: ❌", err));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.html'));
});

// 1. नया यूजर रजिस्ट्रेशन
app.post('/api/register', async (req, res) => {
    const { name, mobile, password } = req.body;
    if (!name || !mobile || !password || mobile.length !== 10) {
        return res.json({ success: false, msg: "कृपया सभी जानकारी और सही 10-अंकों का मोबाइल नंबर डालें!" });
    }
    
    try {
        const existUser = await usersCollection.findOne({ mobile: mobile });
        if (existUser) {
            return res.json({ success: false, msg: "यह मोबाइल नंबर पहले से रजिस्टर्ड है! कृपया लॉगिन करें।" });
        }
        
        const newUser = {
            name: name,
            mobile: mobile,
            password: password,
            balance: 500, 
            totalDeposited: 0,
            bankDetails: null
        };
        
        await usersCollection.insertOne(newUser);
        return res.json({ success: true, msg: "रजिस्ट्रेशन सफल! अब लॉगिन करें।" });
    } catch (e) {
        res.json({ success: false, msg: "डेटाबेस एरर, कृपया दोबारा प्रयास करें।" });
    }
});

// 2. लॉगिन API (क्रैश-प्रूफ फिक्स के साथ)
app.post('/api/login', async (req, res) => {
    const { mobile, password } = req.body;
    if (!mobile || !password) {
        return res.json({ success: false, msg: "कृपया मोबाइल नंबर और पासवर्ड दोनों डालें!" });
    }
    
    try {
        const user = await usersCollection.findOne({ mobile: mobile, password: password });
        if (user) {
            // मोंगोडीबी की स्पेशल आईडी को सादे टेक्स्ट में बदलकर भेजना ताकि सर्वर क्रैश न हो
            const safeUser = {
                name: user.name,
                mobile: user.mobile,
                balance: user.balance,
                totalDeposited: user.totalDeposited,
                bankDetails: user.bankDetails
            };
            return res.json({ success: true, msg: "लॉगिन सफल!", user: safeUser });
        }
        return res.json({ success: false, msg: "गलत मोबाइल नंबर या पासवर्ड!" });
    } catch (e) {
        res.json({ success: false, msg: "लॉगिन फेल!" });
    }
});

// 3. बैंक डिटेल्स सेव करने का API
app.post('/api/save-bank', async (req, res) => {
    const { mobile, bankName, accNo, ifsc, holderName } = req.body;
    try {
        await usersCollection.updateOne(
            { mobile: mobile },
            { $set: { bankDetails: { bankName, accNo, ifsc, holderName } } }
        );
        const updatedUser = await usersCollection.findOne({ mobile: mobile });
        const safeUser = {
            name: updatedUser.name,
            mobile: updatedUser.mobile,
            balance: updatedUser.balance,
            totalDeposited: updatedUser.totalDeposited,
            bankDetails: updatedUser.bankDetails
        };
        return res.json({ success: true, msg: "बैंक डिटेल्स सफलतापूर्वक सुरक्षित हो गईं!", user: safeUser });
    } catch (e) {
        return res.json({ success: false, msg: "सेव करने में विफल!" });
    }
});

// लाइव प्रेडिक्शन गेम लॉजिक
let colorBets = { Black: 0, White: 0, Purple: 0 };
let numberBets = {}; 
for(let i=0; i<100; i++) { numberBets[String(i).padStart(2, '0')] = 0; }

let colorTimer = 60; 
let numberTimer = 3600; 
let currentRoundColorId = Date.now();
let currentRoundNumberId = Date.now() + 1;

setInterval(() => {
    if (colorTimer > 0) {
        colorTimer--;
    } else {
        let winningColor = 'Black';
        let minColorAmt = colorBets['Black'];

        ['White', 'Purple'].forEach(color => {
            if (colorBets[color] < minColorAmt) {
                minColorAmt = colorBets[color];
                winningColor = color;
            }
        });

        if (colorBets['Black'] === colorBets['White'] && colorBets['White'] === colorBets['Purple']) {
            const colors = ['Black', 'White', 'Purple'];
            winningColor = colors[Math.floor(Math.random() * colors.length)];
        }

        io.emit('color_result', { roundId: currentRoundColorId, win: winningColor });
        colorBets = { Black: 0, White: 0, Purple: 0 };
        colorTimer = 60;
        currentRoundColorId = Date.now();
    }
    io.emit('color_timer_update', { time: colorTimer, roundId: currentRoundColorId, freeze: colorTimer <= 5 });
}, 1000);

setInterval(() => {
    if (numberTimer > 0) {
        numberTimer--;
    } else {
        let winningNumber = '00';
        let minNumberAmt = numberBets['00'];

        for (let i = 0; i < 100; i++) {
            let numStr = String(i).padStart(2, '0');
            if (numberBets[numStr] < minNumberAmt) {
                minNumberAmt = numberBets[numStr];
                winningNumber = numStr;
            }
        }

        io.emit('number_result', { roundId: currentRoundNumberId, win: winningNumber });
        for(let i=0; i<100; i++) { numberBets[String(i).padStart(2, '0')] = 0; }
        numberTimer = 3600;
        currentRoundNumberId = Date.now() + 1;
    }
    io.emit('number_timer_update', { time: numberTimer, roundId: currentRoundNumberId, freeze: numberTimer <= 5 });
}, 1000);

app.post('/api/place-bet', (req, res) => {
    const { gameType, selection, amount } = req.body;
    if (gameType === 'color' && colorBets[selection] !== undefined) {
        colorBets[selection] += Number(amount);
        return res.json({ success: true, msg: "बेट लग गई है" });
    } 
    else if (gameType === 'number' && numberBets[selection] !== undefined) {
        numberBets[selection] += Number(amount);
        return res.json({ success: true, msg: "बेट लग गई है" });
    }
    res.json({ success: false, msg: "गलत एंट्री" });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`GT Server Active on Port ${PORT}`));
