const usersEndpoint = "http://localhost:4001/graphql";
const postsEndpoint = "http://localhost:4002/graphql";
const wsEndpoint = "ws://localhost:4002/graphql"; // WebSocket for subscriptions

// Fetch Users and Posts, then display them
async function loadData() {
    try {
        const users = await fetchUsers();
        const posts = await fetchPosts();

        console.log("Fetched Users:", users);
        console.log("Fetched Posts:", posts);

        renderTable(users, posts);
        subscribeToNewPosts(); // Listen for new posts
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// Fetch Users from GraphQL API
async function fetchUsers() {
    const query = `{
        users {
            id
            name
        }
    }`;

    const response = await fetch(usersEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
    });

    const result = await response.json();
    return result.data.users;
}

// Fetch Posts from GraphQL API
async function fetchPosts() {
    const query = `{
        posts {
            id
            title
            content
            authorId
        }
    }`;

    const response = await fetch(postsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
    });

    const result = await response.json();
    return result.data.posts;
}

// Render Data Table
function renderTable(users, posts) {
    console.log("Rendering Table...");
    const tableBody = document.getElementById("postsTable");
    tableBody.innerHTML = ""; // Clear previous data

    users.forEach(user => {
        // Insert User Row with data-user-id
        let userRow = document.createElement("tr");
        userRow.classList.add("user-row");
        userRow.setAttribute("data-user-id", user.id); // Store userId for reference
        userRow.innerHTML = `<td colspan="3">${user.name}</td>`;
        tableBody.appendChild(userRow);

        // Filter and Insert Posts for the User
        posts
            .filter(post => post.authorId == user.id)
            .forEach(post => insertPostRow(user.id, post));
    });
}

// Insert a New Post Row Under the Correct User
function insertPostRow(userId, post) {
    console.log(`Inserting post for user ${userId}:`, post);

    const tableBody = document.getElementById("postsTable");

    // Check if post already exists in the table to avoid duplicates
    if (document.getElementById(`post-${post.id}`)) {
        console.log(`Post with ID ${post.id} already exists. Skipping insertion.`);
        return;
    }

    let postRow = document.createElement("tr");
    postRow.id = `post-${post.id}`; // Unique ID for each post row
    postRow.innerHTML = `
        <td></td>
        <td>${post.title}</td>
        <td>${post.content}</td>
    `;

    // Find the last row of the corresponding user using data-user-id
    let userRow = document.querySelector(`tr[data-user-id="${userId}"]`);

    if (userRow) {
        userRow.insertAdjacentElement("afterend", postRow); // Insert right after the user row
        console.log("Post inserted successfully.");
    } else {
        console.log("No matching userRow found! Appending to the end.");
        tableBody.appendChild(postRow);
    }
}

function subscribeToNewPosts() {
    let ws;
    let reconnectTimeout;
    let heartbeatInterval;

    function connectWebSocket() {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            console.log("WebSocket is already open or connecting...");
            return;
        }

        ws = new WebSocket("ws://localhost:4002/graphql");

        ws.onopen = () => {
            console.log("Connected to WebSocket for new posts");

            ws.send(JSON.stringify({
                id: "1",
                type: "subscribe",
                payload: {
                    query: `subscription {
                        postCreated {
                            id
                            title
                            content
                            authorId
                        }
                    }`
                }
            }));

            heartbeatInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ id: "1", type: "ping" }));
                    console.log("Sent heartbeat ping");
                }
            }, 30000);
        };

        ws.onmessage = (event) => {
            console.log("WebSocket message received:", event.data);
            const data = JSON.parse(event.data);
        
            if (data.type === "data" && data.payload?.data?.postCreated) {
                const post = data.payload.data.postCreated;
                console.log("New post received:", post);
                insertPostRow(post.authorId, post);
            } else {
                console.log("Unhandled WebSocket message:", data);
            }
        };
        
        ws.onerror = (error) => {
            console.error("WebSocket Error:", error);
        };

        ws.onclose = () => {
            console.log("WebSocket disconnected. Reconnecting in 3 seconds...");
            clearInterval(heartbeatInterval);
            reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };
    }

    connectWebSocket();
}

// Load Data on Page Load
document.addEventListener("DOMContentLoaded", loadData);
