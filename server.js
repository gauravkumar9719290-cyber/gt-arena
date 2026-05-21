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

// डमी डेटाबेस (असली डेटाबेस जुड़ने तक मोबाइल नंबर और बैलेंस यहाँ सेव रहेंगे)
let usersDB = {}; 
let otpStore = {}; // OTP वेरीफाई करने के लिए

// 1. OTP भेजने का API (अभी टेस्टिंग के लिए OTP हमेशा '1234' रहेगा)
app.post('/api/send-otp', (req, res) => {
    const { mobile } = req.body;
    if (!mobile || mobile.length !== 10) {
        return res.json({ success: false, msg: "कृपया सही 10-अंकों का मोबाइल नंबर डालें!" });
    }
    otpStore[mobile] = "1234"; // डमी OTP सेट किया
    return res.json({ success: true, msg: "OTP आपके नंबर पर भेज दिया गया है! (टेस्टिंग OTP: 1234)" });
});

// 2. OTP वेरीफाई करके अकाउंट बनाने या लॉगिन करने का API
app.post('/api/verify-otp', (req, res) => {
    const { mobile, otp } = req.body;
    if (otpStore[mobile] && otpStore[mobile] === otp) {
        delete otpStore[mobile]; // इस्तेमाल के बाद OTP साफ़ करें
        
        // अगर यूजर नया है, तो उसे ₹500 वेलकम बोनस के साथ रजिस्टर करें
        if (!usersDB[mobile]) {
            usersDB[mobile] = {
                mobile: mobile,
                balance: 500,
                totalDeposited: 0
            };
        }
        return res.json({ success: true, msg: "लॉगिन सफल!", user: usersDB[mobile] });
    }
    return res.json({ success: false, msg: "गलत OTP! कृपया दोबारा जांचें।" });
});

// लाइव सट्टा वेरिएबल्स
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
