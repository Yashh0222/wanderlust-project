# Wanderlust

**Wanderlust** is a full-stack, Airbnb-like travel accommodation platform that allows users to discover, list, and book unique stays. It features secure authentication, interactive maps, cloud-based image storage, and an AI-powered booking agent that uses semantic search and LangGraph to help users find and book properties with explicit confirmation.

**Live Demo:** [https://wanderlust-project-18.onrender.com/](https://wanderlust-project-18.onrender.com/)

> ⚠️ The app is hosted on Render's free tier — the first request after a period of inactivity may take a few seconds to spin up.

## ✨ Features

### Core Platform
- **Property Listings** – Users can create, edit, view, and delete property listings with detailed descriptions, pricing, and location data.
- **Image Uploads** – Seamless image uploads with Cloudinary integration for optimized cloud storage.
- **Search & Filtering** – Browse listings by location and filter by categories for a personalized experience.
- **Reviews & Ratings** – Leave and view reviews on properties to help others make informed decisions.
- **Interactive Maps** – Integrated with Leaflet and Mapbox to visualize property locations.
- **Bookings & Payments** – Secure booking flow with Razorpay payment gateway integration.
- **Authentication & Authorization** – Secure user login with local authentication and Google OAuth 2.0 via Passport.js.
- **Session Management** – Persistent sessions with MongoDB-backed storage.
- **Flash Messages** – User-friendly feedback for actions like login, signup, and CRUD operations.

### AI Booking Agent
- **Conversational Booking** – Natural language interface to search and book listings through an intelligent AI agent.
- **Semantic Search** – Vector-based search powered by local embeddings (Xenova/all-MiniLM-L6-v2) for context-aware results beyond keyword matching.
- **LangGraph-Powered Reasoning** – Agentic flow that decides when to search, when to book, and when to seek clarification.
- **Explicit Confirmation Flow** – Bookings are **never** executed automatically; the agent pauses and requires user confirmation before creating a booking.
- **Groq LLM Integration** – Fast, cost-effective inference using Groq's LLMs.
- **MongoDB Atlas Vector Search** – Scalable semantic retrieval using vector embeddings stored with each listing.

## 🏗️ Architecture Overview

Wanderlust follows the **MVC (Model-View-Controller)** architecture for clean separation of concerns.

- **Models** – Mongoose schemas for Users, Listings, Reviews, and Bookings.
- **Views** – Server-rendered EJS templates with EJS-Mate layouts and Bootstrap styling.
- **Controllers** – Business logic for handling CRUD operations, authentication, reviews, and bookings.
- **Routes** – RESTful route definitions for listings, reviews, users, bookings, payments, and the AI agent.
- **Middleware** – Custom validation, authentication checks, error handling, and session management.
- **AI Layer** – LangGraph agent with tools for semantic search and booking, backed by local embeddings and Groq LLM.

## 🔭 High-Level Flow

```
User
  ↓
Express App (EJS Views)
  ↓
Routes → Controllers → Models (MongoDB)
  ↓
Services: Cloudinary, Razorpay, Passport.js, LangGraph Agent

AI Flow:
User Message → LangGraph Agent → Semantic Search (Vector DB) → Pause for Confirmation → Book on Approval
```

## 🛠️ Tech Stack

### Backend
- **Node.js 24.11.0** – Runtime environment
- **Express.js 5.1.0** – Web framework
- **MongoDB** – NoSQL database
- **Mongoose 8.19.3** – ODM for MongoDB
- **Passport.js** – Authentication (Local & Google OAuth 20)
- **express-session + connect-mongo** – Session management
- **LangChain Core, LangGraph, Groq** – AI agent framework & LLM orchestration
- **Xenova/Transformers** – Local text embeddings for semantic search
- **Zod** – Schema validation for agent tools
- **Razorpay** – Payment processing
- **Cloudinary** – Image storage & transformation
- **Multer** – Multipart file uploads
- **Joi** – Request validation
- **Nodemailer** – Email notifications

### Frontend
- **EJS** – Templating engine
- **EJS-Mate** – Layout support for EJS
- **Bootstrap** – Responsive UI components
- **Leaflet.js** – Interactive maps
- **Mapbox** – Geocoding & map tiles

### Dev Tools
- **dotenv** – Environment variable management
- **connect-flash** – Flash messaging
- **method-override** – HTTP verb override for forms
- **axios** – HTTP client

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v24.11.0
- [MongoDB](https://www.mongodb.com/) (Local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- Accounts for required services (see Environment Variables)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd "Major Project"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Create a `.env` file in the root directory
   - Add the required variables (see section below)

4. **Start MongoDB**
   - If using local MongoDB: `mongod`
   - If using Atlas: ensure your connection string is correct

5. **Run the application**
   ```bash
   node app.js
   ```
   The app will run on `http://localhost:8080`

## 🔐 Environment Variables

Create a `.env` file in the root directory with the following variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `ATLASDB_URL` | Yes | MongoDB Atlas connection string (or local MongoDB URL) |
| `SECRET` | Yes | Session secret key |
| `GROQ_API_KEY` | Yes | Groq API key for the AI booking agent |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Optional | OAuth callback URL (defaults to `http://localhost:8080/auth/google/callback`) |
| `RAZORPAY_KEY_ID` | Optional | Razorpay API key ID for payments |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay API key secret |
| `CLOUDINARY_CLOUD_NAME` | Optional | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Optional | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Optional | Cloudinary API secret |
| `NODE_ENV` | Optional | Set to `production` for deployment |

## 🤖 AI Agent Setup (Semantic Search)

To enable the AI booking agent with semantic search:

1. **Get a Groq API key** – Sign up at [console.groq.com](https://console.groq.com/) and create an API key.

2. **Move to MongoDB Atlas** – Vector Search requires MongoDB Atlas (free M0 cluster is sufficient). Update `ATLASDB_URL` accordingly.

3. **Backfill embeddings for existing listings** – Run the one-time backfill script:
   ```bash
   node backfillEmbeddings.js
   ```

4. **Create Atlas Vector Search Index** – In Atlas UI, go to Cluster → Search → Create Search Index (JSON Editor) on the `listings` collection:
   ```json
   {
     "fields": [
       {
         "type": "vector",
         "path": "embedding",
         "numDimensions": 384,
         "similarity": "cosine"
       }
     ]
   }
   ```
   Name it: `listing_vector_index`

5. **Interact with the agent** – Visit the app and use the AI booking interface to search and book listings. The agent will pause for explicit confirmation before creating any booking.

## 📁 Project Structure

```
Major Project/
├── agent/           # AI agent logic (LangGraph tools & graph)
├── Models/          # Mongoose schemas (User, Listing, Review, Booking)
├── controllers/     # Route controllers
├── routes/          # Express route handlers
├── utils/           # Utility functions (wrappers, helpers, embeddings, semantic search)
├── views/           # EJS templates
├── public/          # Static assets (CSS, JS, images)
├── uploads/         # Local uploads (dev only)
├── init/            # Database initialization/data seeding
├── middleware.js    # Custom middleware
├── app.js           # Main application entry point
├── schema.js        # Joi validation schemas
├── backfillEmbeddings.js # Script to backfill listing embeddings
└── package.json     # Project metadata & dependencies
```

## 🎯 Project Highlights

- **Full-Stack Airbnb Clone** – Complete end-to-end travel accommodation platform with real-world features.
- **Agentic AI Booking** – Combines conversational AI with semantic search and human-in-the-loop confirmation to prevent accidental bookings.
- **Document-Grounded Search** – Semantic retrieval using local embeddings ensures relevant, context-aware property results.
- **Secure Auth Flow** – Local + Google OAuth with session-based authentication and authorization.
- **Seamless Payments** – Integrated Razorpay checkout for secure transactions.
- **Production-Ready Deployment** – Configured for Render with MongoDB Atlas and Cloudinary.
- **MVC Architecture** – Maintainable, scalable codebase following industry best practices.

## 🚀 Deployment

The application is deployed on [Render](https://render.com/). For your own deployment:

1. Push your code to a Git repository (GitHub/GitLab).
2. Create a new Web Service on Render and connect your repository.
3. Set the environment variables in Render's dashboard (same as `.env`).
4. Set the build command: `npm install`
5. Set the start command: `node app.js`
6. Deploy and access your live URL.

## 🗺️ Future Improvements

- **Multi-language Support** – Translate UI and agent responses.
- **Advanced Filters** – Price range, amenities, availability calendar, etc.
- **Real-time Chat** – Direct messaging between hosts and guests.
- **Wishlist/Favorites** – Save preferred listings.
- **AI Recommendations** – Personalized stay suggestions based on user preferences.
- **Persistent Checkpointer** – Replace in-memory checkpointer for multi-instance deployments.
- **Hosted Embeddings** – Swap local Xenova embeddings for a hosted API to reduce cold start time.

## 📝 Notes

- **Embeddings Model** – Uses `Xenova/all-MiniLM-L6-v2` (384-dim). Downloads ~90MB on first run and runs in-process.
- **Free Tier Considerations** – Render free tier may have slower cold starts, especially on first AI/embedding load.
- **Safety First** – The AI booking agent uses `interruptBefore: ["awaitConfirmation"]` to enforce explicit user confirmation before any booking is created.