import nodeCron from "node-cron";
import { prisma } from "../db/prisma";

async function deleteUnverifiedUsers(user_id: number) {
    await prisma.users.delete({
        where: {
            user_id,
        },
    }).then(() => {
        console.log(`Deleted unverified user with ID: ${user_id}`);
    }).catch((error) => {
        console.error(`Error deleting unverified user with ID: ${user_id}`, error);
    });
}
async function fetchAndDeleteUnverifiedUsers() {
    prisma.users.findMany({
        where: {
            verified: false
        },
        select: {
            user_id: true,
            created_at: true,
        }
    }).then((users) => {        
        const now = new Date();
        users.forEach(user => {
            const createdAt = new Date(user.created_at);
            const hoursDifference = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
            // Delete user unverified for more than 7 days (168 hours)
            if (hoursDifference > 168) {
                deleteUnverifiedUsers(user.user_id);
            }
        });
    }).catch((error) => {
        console.error("Error fetching unverified users", error);
    });
}

export default function scheduleUnverifiedUserDeletion() {
    // Schedule the task to run every midnight
    nodeCron.schedule('0 0 * * *', () => {
        console.log("Running scheduled task to delete unverified users...");
        fetchAndDeleteUnverifiedUsers();
    }, {
        timezone: "Asia/Karachi",
    });
}