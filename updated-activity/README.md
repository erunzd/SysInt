# 📚 System Integration and Architecture - Activity Submissions

This repository contains the submissions for various activities in the System Integration and Architecture course. The project demonstrates integration and communication between microservices.

## 🧩 Project Structure

The repository consists of the following services:

- **`users-service`** – Demonstrates a simple user database.
- **`post-service`** – Manages user posts, including creation, retrieval, and deletion.
- **`app`** – A basic table app that displays the posts created by the users.
- **`be-post-persister`** – Subscribes to any new messages and inserts them to 'posts' table.
- **`be-post-sub`** – Generates synthetic post data and publishes them.

## ⚙️ Technologies Used

- **Vanilla JS** (utilized for the app)
- **Node.js** (used for the services)
- **Prisma** 
- **Apollo**
- **PostgreSQL**
- **ActiveMQ** 

## 🚀 Getting Started