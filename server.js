import express from "express";
import database from "./firebaseConfig.js"; // Import the database instance
import { ref, get, onValue, set, child } from "firebase/database"; // Import database functions
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

// Middleware to parse JSON bodies (if needed for future POST requests)
app.use(express.json());

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to format activity data concisely
const formatActivity = (activity, userId) => {
  if (!activity) return `No activity data available for user ${userId}`;
  const { name, email, action, timestamp } = activity;
  if (!name || !email || !action || !timestamp) {
    return `Invalid activity data for user ${userId}`;
  }
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return `Invalid timestamp in activity data for user ${userId}`;
  }
  return `${name} (${email}) ${action} at ${date.toLocaleString()} (User ${userId})`;
};

// Function to get the most recent activity across all users
const displayRecentActivity = async () => {
  const activityRef = ref(database, "activity");
  try {
    const snapshot = await get(activityRef);
    if (snapshot.exists()) {
      const activityData = snapshot.val();
      let latestEntry = null;
      let latestTimestamp = 0;
      let latestUserId = null;
      let latestKey = null;

      // Iterate through all users
      for (const [userId, userActivities] of Object.entries(activityData)) {
        if (userActivities && typeof userActivities === "object") {
          const entries = Object.entries(userActivities);
          const userLatest = entries[entries.length - 1]; // Most recent for this user
          if (userLatest) {
            const [key, value] = userLatest;
            if (value && value.timestamp) {
              const timestamp = new Date(value.timestamp).getTime();
              if (timestamp > latestTimestamp) {
                latestTimestamp = timestamp;
                latestEntry = value;
                latestUserId = userId;
                latestKey = key;
              }
            }
          }
        }
      }

      if (latestEntry) {
        console.log(
          "Most recent activity:",
          formatActivity(latestEntry, latestUserId)
        );
        return { userId: latestUserId, key: latestKey };
      } else {
        console.log("No valid activity data available");
        return null;
      }
    } else {
      console.log("No activity data available");
      return null;
    }
  } catch (error) {
    console.error("Error fetching recent activity:", error.message);
    return null;
  }
};

// Track the last seen activity key for each user
const lastSeenKeys = new Map(); // Map<userId, lastSeenKey>

// Listener for new activity data for any user
const activityRef = ref(database, "activity");
onValue(activityRef, (activitySnapshot) => {
  const activityData = activitySnapshot.val();
  if (activityData) {
    // Iterate through all users to find new activities
    for (const [userId, userActivities] of Object.entries(activityData)) {
      if (userActivities && typeof userActivities === "object") {
        const entries = Object.entries(userActivities);
        const latestEntry = entries[entries.length - 1]; // Most recent for this user
        if (latestEntry) {
          const [key, value] = latestEntry;
          const lastKey = lastSeenKeys.get(userId);

          if (key !== lastKey && value && value.timestamp) {
            lastSeenKeys.set(userId, key); // Update the last seen key for this user
          }
        }
      }
    }
  }
});

// Listener for changes to the "Lock" field
const lockRef = ref(database, "Lock");
onValue(lockRef, async (snapshot) => {
  const lockValue = snapshot.val();
  const recentActivity = await displayRecentActivity();

  if (recentActivity) {
    const { userId, key } = recentActivity;
    const activityRef = ref(database, `activity/${userId}/${key}`);
    const activitySnapshot = await get(activityRef);

    if (activitySnapshot.exists()) {
      const activity = activitySnapshot.val();
      const { name, email, action, timestamp } = activity;
      const formattedDate = new Date(timestamp).toLocaleString();

      // Create an HTML table for the email body
      const emailBody = `
       <div style="max-width: 600px; margin: 20px auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e0e0e0;">
  <div style="background-color: #3a7bd5; color: white; padding: 20px; text-align: center;">
    <h2 style="margin: 0;">🔒 DoorGuard Event Notification</h2>
    <p style="margin: 5px 0 0;">A door access action has been logged</p>
  </div>
  <table style="width: 100%; border-collapse: collapse; color: #333;">
    <tbody>
      <tr style="background-color: #f9f9f9;">
        <td style="padding: 12px 20px; font-weight: 600;">Name</td>
        <td style="padding: 12px 20px;">${name}</td>
      </tr>
      <tr>
        <td style="padding: 12px 20px; font-weight: 600; background-color: #f9f9f9;">Email</td>
        <td style="padding: 12px 20px;">${email}</td>
      </tr>
      <tr>
        <td style="padding: 12px 20px; font-weight: 600; background-color: #f9f9f9;">Action</td>
        <td style="padding: 12px 20px;">${action}</td>
      </tr>
      <tr>
        <td style="padding: 12px 20px; font-weight: 600; background-color: #f9f9f9;">Timestamp</td>
        <td style="padding: 12px 20px;">${formattedDate}</td>
      </tr>
      <tr>
        <td style="padding: 12px 20px; font-weight: 600; background-color: #f9f9f9;">User ID</td>
        <td style="padding: 12px 20px;">${userId}</td>
      </tr>
    </tbody>
  </table>
  <div style="background-color: #f1f1f1; text-align: center; padding: 15px; font-size: 12px; color: #777;">
    DoorGuard by SmartHome Solutions<br>
    If this action wasn't expected, please investigate immediately.
  </div>
</div>

      `;
      //   Oshanvimukththi@gmail.com
      // Send email with the HTML table
      const mailOptions = {
        from: `"DoorGuard" <${process.env.EMAIL_USER}>`,

        to: "Oshanvimukththi@gmail.com", // Replace with the recipient's email
        subject: "Door Lock/Unlock Event Triggered",
        html: emailBody, // Use the HTML table as the email body
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
        } else {
          console.log("Email sent:", info.response);
        }
      });
    }
  }
});

// Route to show all data in the database
app.get("/all-data", (req, res) => {
  const dbRef = ref(database);
  get(dbRef)
    .then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        res.json(data);
      } else {
        res.status(404).send("No data available in the database");
      }
    })
    .catch((error) => {
      res.status(500).send("Error reading database: " + error.message);
    });
});

// Example route to write data to Firebase
app.get("/write", (req, res) => {
  const dbRef = ref(database, "example/path");
  set(dbRef, { message: "Hello, Firebase!" })
    .then(() => res.send("Data written successfully!"))
    .catch((error) =>
      res.status(500).send("Error writing data: " + error.message)
    );
});

// Example route to read data from Firebase
app.get("/read", (req, res) => {
  const dbRef = ref(database);
  get(child(dbRef, "example/path"))
    .then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        res.json(data);
      } else {
        res.status(404).send("No data available at example/path");
      }
    })
    .catch((error) => {
      res.status(500).send("Error reading data: " + error.message);
    });
});

// Route to send an email
app.post("/send-email", (req, res) => {
  const { to, subject, text } = req.body;

  if (!to || !subject || !text) {
    return res.status(400).send("Missing required fields: to, subject, text");
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).send("Error sending email: " + error.message);
    }
    res.send("Email sent successfully!");
  });
});

// Route to check server status
app.get("/isServerDJ", (req, res) => {
  res.send("Server is DJ!");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
