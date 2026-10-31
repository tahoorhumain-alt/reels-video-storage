const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// --- YOUR GITHUB DETAILS ---
const GITHUB_USER = 'tahoorhumain-alt'; 
const GITHUB_REPO = 'reels-video-storage'; 
const GITHUB_TAG = 'v1.0.0';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 

const uploadMiddleware = (req, res, next) => {
    upload.single('video')(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: 'Upload Error: ' + err.message });
        } else if (err) {
            return res.status(500).json({ error: 'Server Error: ' + err.message });
        }
        next();
    });
};

app.post('/upload', uploadMiddleware, async (req, res) => {
    try {
        if (!GITHUB_TOKEN) {
            return res.status(500).json({ error: 'Server Error: GITHUB_TOKEN is missing in Render Environment Variables.' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file received by server. Field name must be "video".' });
        }

        const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const uploadUrl = `https://uploads.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases/tags/${GITHUB_TAG}/assets?name=${fileName}`;

        console.log(`Attempting to upload ${fileName} to GitHub...`);

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/octet-stream',
                'Content-Length': req.file.size.toString() // FIX: Must be a string
            },
            body: req.file.buffer
        });

        const responseText = await response.text();
        let data = {};
        try { data = JSON.parse(responseText); } catch(e) {
            return res.status(500).json({ error: 'GitHub returned HTML instead of JSON. Make sure the release tag ' + GITHUB_TAG + ' exists.' });
        }

        if (response.ok && data.browser_download_url) {
            const playUrl = `${req.protocol}://${req.get('host')}/stream/${fileName}`;
            res.json({ success: true, url: playUrl });
        } else {
            console.log("GitHub Error:", data);
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