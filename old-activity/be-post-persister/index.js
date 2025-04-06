const { PrismaClient } = require('@prisma/client');
const Stomp = require('stompjs');

const prisma = new PrismaClient();
const PORT = 6123; // Not used for STOMP, kept for reference
const QUEUE_NAME = '/queue/posts';
const ACTIVEMQ_HOST = 'localhost';
const ACTIVEMQ_PORT = 61613;

// Connect to ActiveMQ
const client = Stomp.client(`tcp://${ACTIVEMQ_HOST}:${ACTIVEMQ_PORT}`);
client.connect('admin', 'admin', () => {
    console.log('Connected to ActiveMQ');

    // Subscribe to the queue
    client.subscribe(QUEUE_NAME, async (message) => {
        const post = JSON.parse(message.body);
        const { title, content, authorId } = post;

        // Validate incoming data
        if (!title || !content || !authorId) {
            console.error('Invalid post received:', post);
            return;
        }

        try {
            // Insert the post into the database
            const newPost = await prisma.post.create({
                data: {
                    title,
                    content,
                    authorId: parseInt(authorId)
                }
            });
            console.log('Persisted new post:', newPost);
            message.ack(); // Acknowledge the message
        } catch (error) {
            console.error('Error persisting post:', error);
        }
    }, { ack: 'client' }); // Manual acknowledgment
}, (error) => {
    console.error('Error connecting to ActiveMQ:', error);
});

console.log(`BE_POST_PERSISTER subscribing to ${QUEUE_NAME}`);

// Cleanup on shutdown
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    client.disconnect(() => {
        console.log('Disconnected from ActiveMQ');
        process.exit(0);
    });
});