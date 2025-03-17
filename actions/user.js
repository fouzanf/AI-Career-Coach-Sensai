"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { generateAIInsights } from "./dashboard";

export async function updateUser(data) {
  const { userId } = await auth();
  if (!userId) return { success: false, message: "Unauthorized" };

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) return { success: false, message: "User not found" };

  try {
    let industryInsight = await db.industryInsight.findUnique({
      where: { industry: data.industry },
    });

    // Generate AI insights BEFORE transaction starts
    let insights = null;
    if (!industryInsight) {
      insights = await generateAIInsights(data.industry);
    }

    const updatedUser = await db.$transaction(async (tx) => {
      if (!industryInsight && insights) {
        industryInsight = await tx.industryInsight.create({
          data: {
            industry: data.industry,
            ...insights,
            nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days later
          },
        });
      }

      return await tx.user.update({
        where: { id: user.id },
        data: {
          industry: data.industry,
          experience: data.experience,
          bio: data.bio,
          skills: data.skills,
        },
      });
    });

    console.log("✅ API Response:", { success: true, user: updatedUser });

    return { success: true, user: updatedUser, industryInsight };
  } catch (error) {
    console.error("❌ Error updating user:", error.message);
    return { success: false, message: "Failed to update profile: " + error.message };
  }
}




export async function getUserOnboardingStatus() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
      select: {
        industry: true,
      },
    });

    return {
      isOnboarded: !!user?.industry,
    };
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    throw new Error("Failed to check onboarding status");
  }
}