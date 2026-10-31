const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

// --- YOUR GITHUB DETAILS ---
const GITHUB_USER = 'tahoorhumain-alt'; // Your username from the screenshot
const GITHUB_REPO = 'reels-video-storage'; // The repo you just made
const GITHUB_TAG = 'v1.0.0';
const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN'; // PASTE YOUR NEW TOKEN HERE

app.post('/upload', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

        const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const uploadUrl = `https://uploads.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases/tags/${GITHUB_TAG}/assets?name=${fileName}`;

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/octet-stream',
                'Content-Length': req.file.size
            },
            body: req.file.buffer
        });

        const data = await response.json();

        if (data.browser_download_url) {
            const playUrl = `${req.protocol}://${req.get('host')}/stream/${fileName}`;
            res.json({ success: true, url: playUrl });
        } else {
            res.status(500).json({ error: data.message || 'GitHub upload failed.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/stream/:filename', async (req, res) => {
    try {
        const fileName = req.params.filename;
        const assetUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases/tags/${GITHUB_TAG}/assets`;

        const assetRes = await fetch(assetUrl, { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } });
        const assets = await assetRes.json();
        const asset = assets.find(a => a.name === fileName);
        
        if (!asset) return res.status(404).send('Video not found');

        const videoRes = await fetch(asset.url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/octet-stream' }
        });

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        videoRes.body.pipe(res);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));