// Improved server.js with proper error handling and validation

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Middleware for validation
app.use((req, res, next) => {
    // Basic validation example
    if (!req.body.name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    next();
});

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/data', (req, res) => {
    try {
        // Process the data
        const data = req.body;
        // Validate data here
        // Example: if (!data.value) throw new Error('Value is required');
        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});