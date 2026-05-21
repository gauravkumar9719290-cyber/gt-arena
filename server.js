const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.html'));
});

// यूज़र्स का डमी डेटाबेस (नंबर, नाम, पासवर्ड और बैंक डिटेल्स यहाँ सेव रहेंगी)
let usersDB = {}; 

// 1. नया यूजर रजिस्ट्रेशन API
app.post('/api/register', (req, res) => {
    const { name, mobile, password } = req.body;
    if (!name || !mobile || !password || mobile.length !== 10) {
        return res.json({ success: false, msg: "कृपया सभी जानकारी और सही 10-अंकों का मोबाइल नंबर डालें!" });
    }
    if (usersDB[mobile]) {
        return res.json({ success: false, msg: "यह मोबाइल नंबर पहले से रजिस्टर्ड है! कृपया लॉगिन करें।" });
    }
    
    // नया यूजर बनाएं (₹500 वेलकम बोनस के साथ)
    usersDB[mobile] = {
        name: name,
        mobile: mobile,
        password: password,
        balance: 500,
        totalDeposited: 0,
        bankDetails: null // शुरुआत में खाली रहेगा
    };
    return res.json({ success: true, msg: "रजिस्ट्रेशन सफल! अब लॉगिन करें।" });
});

// 2. लॉगिन API
app.post('/api/login', (req, res) => {
    const { mobile, password } = req.body;
    if (!mobile || !password) {
        return res.json({ success: false, msg: "कृपया मोबाइल नंबर और पासवर्ड दोनों डालें!" });
    }
    const user = usersDB[mobile];
    if (user && user.password === password) {
        return res.json({ success: true, msg: "लॉगिन सफल!", user: user });
    }
    return res.json({ success: false, msg: "गलत मोबाइल नंबर या पासवर्ड!" });
});

// 3. बैंक डिटेल्स सेव करने का API
app.post('/api/save-bank', (req, res) => {
    const { mobile, bankName, accNo, ifsc, holderName } = req.body;
    if (!usersDB[mobile]) return res.json({ success: false, msg: "यूजर नहीं मिला!" });
    
    usersDB[mobile].bankDetails = { bankName, accNo, ifsc, holderName };
    return res.json({ success: true, msg: "बैंक डिटेल्स सफलतापूर्वक सुरक्षित हो गईं!", user: usersDB[mobile] });
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
