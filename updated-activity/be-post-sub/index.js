const { faker } = require('@faker-js/faker');
const Stomp = require('stompjs');
const http = require('http');

// Configuration
const PORT = 5002;
const POST_INTERVAL = 5000;
const QUEUE_NAME = '/queue/posts'; // ActiveMQ queue name
const ACTIVEMQ_HOST = 'localhost';
const ACTIVEMQ_PORT = 61613;

// Connect to ActiveMQ
const client = Stomp.client(`tcp://${ACTIVEMQ_HOST}:${ACTIVEMQ_PORT}`);
client.connect('admin', 'admin', () => {
    console.log('Connected to ActiveMQ');
}, (error) => {
    console.error('Error connecting to ActiveMQ:', error);
});

// Function to generate synthetic post data
function generateSyntheticPost() {
    return {
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        authorId: faker.number.int({ min: 1, max: 100 })
    };
}

// Create HTTP server (optional, for testing)
const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/posts') {
        const post = generateSyntheticPost();
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(post));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

// Function to publish posts to ActiveMQ
function publishPost(post) {
    if (client.connected) {
        client.send(QUEUE_NAME, {}, JSON.stringify(post));
        console.log(`Published post to ${QUEUE_NAME}: ${post.title}`);
    } else {
        console.error('Cannot publish: Not connected to ActiveMQ');
    }
}

// Function to simulate publishing posts periodically
function startPublishing() {
    setInterval(() => {
        const post = generateSyntheticPost();
        publishPost(post);
    }, POST_INTERVAL);
}

// Start the server and publishing
server.listen(PORT, () => {
    console.log(`BE_POST_SUB running on port ${PORT}`);
    startPublishing();
});

// Cleanup on shutdown
process.on('SIGINT', () => {
    client.disconnect(() => {
        console.log('Disconnected from ActiveMQ');
        process.exit(0);
    });
});