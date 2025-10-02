import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import webpush from 'web-push';

const app = express();

// Allow CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(bodyParser.json());

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || "BGTmeojTVs5wNpp1xynWNJNd4HxZMHfCgDiwdOjGuU4M9MOc2dcx6AHb92UEK7a9Xxg-jiZl33Hkxwt9iExwpHI",
  privateKey: process.env.VAPID_PRIVATE_KEY || "-4p3JEUM-ENbupr-ZnUoAsZd4Gs7LHAR79QeVoNY5Sw",
};

webpush.setVapidDetails(
  'mailto:example@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// In-memory storage (not persistent in serverless environments)
let subscription: webpush.PushSubscription | null = null;
let reminder = {
    time: '', // Format: "HH:MM"
    message: '',
    lastSent: null as Date | null
};

/**
 * Checks if the reminder time is met and sends a push notification.
 */
const checkAndSendNotification = () => {
    if (!reminder.time || !subscription) {
        return; // Not ready yet
    }

    const [hour, minute] = reminder.time.split(':').map(Number);
    const now = new Date();

    if (now.getHours() === hour && now.getMinutes() === minute) {
        // To prevent spamming, check if a notification for this exact minute has already been sent.
        if (reminder.lastSent && 
            reminder.lastSent.toDateString() === now.toDateString() &&
            reminder.lastSent.getHours() === hour &&
            reminder.lastSent.getMinutes() === minute) {
            return;
        }

        console.log('Time matches, sending notification...');
        const payload = JSON.stringify({ title: 'リマインダー', body: reminder.message });
        
        webpush.sendNotification(subscription, payload)
            .then(() => {
                reminder.lastSent = new Date();
                console.log('Notification sent successfully.');
            })
            .catch(error => {
                console.error('Error sending notification:', error);
            });
    }
};

app.get('/api', (req: Request, res: Response) => {
    res.send('API is running.');
});

app.post('/api/save-subscription', (req: Request, res: Response) => {
  subscription = req.body;
  res.status(201).json({});
  console.log('Subscription saved.');
});

app.post('/api/set-reminder', (req: Request, res: Response) => {
    const { time, message } = req.body;
    if (!time || !message) {
        return res.status(400).json({ error: 'Time and message are required.' });
    }
    // Reset lastSent when a new reminder is set
    reminder = { time, message, lastSent: null };
    res.status(201).json({});
    console.log(`Reminder set for ${time}: ${message}`);
});

// Cron job endpoint for Vercel
app.get('/api/cron', (req: Request, res: Response) => {
    console.log('Cron job triggered by Vercel.');
    checkAndSendNotification();
    res.status(200).send('Cron job executed.');
});

// Export the app for serverless environments
export default app;

// --- Local Development Only ---
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
  
  // Simulate the Vercel cron job for local testing
  if (!process.env.VERCEL) { // A simple check to not run this on Vercel
    console.log('Local cron simulation started (checks every minute).');
    setInterval(checkAndSendNotification, 60 * 1000);
  }
});