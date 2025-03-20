const usersEndpoint = "http://localhost:4001/graphql";
const postsEndpoint = "http://localhost:4002/graphql";

// Fetch Users and Posts, then display them
async function loadData() {
    try {
        const users = await fetchUsers();
        const posts = await fetchPosts();
        renderTable(users, posts);
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
    const tableBody = document.getElementById("postsTable");
    tableBody.innerHTML = ""; // Clear previous data

    users.forEach(user => {
        // Insert User Row
        let userRow = document.createElement("tr");
        userRow.classList.add("user-row");
        userRow.innerHTML = `<td colspan="3">${user.name}</td>`;
        tableBody.appendChild(userRow);

        // Filter and Insert Posts for the User
        posts
            .filter(post => post.authorId == user.id)
            .forEach(post => {
                let postRow = document.createElement("tr");
                postRow.innerHTML = `
                    <td></td>
                    <td>${post.title}</td>
                    <td>${post.content}</td>
                `;
                tableBody.appendChild(postRow);
            });
    });
}

// Load Data on Page Load
document.addEventListener("DOMContentLoaded", loadData);
