import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import {api} from "./_generated/api"
import { headers } from 'next/headers'

const http = httpRouter()


http.route({
    path: "/clerk-webhook",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        const webhookSecret = process.env.Clerk_web_hook;
        console.log(webhookSecret)
        if (!webhookSecret){
            throw new Error("Missing Clerk_web_hook envirnoment variable")
        }

        const svix_id = request.headers.get("svix-id")
        const svix_signature = request.headers.get("svix-signature")
        const svix_timestamp = request.headers.get("svix-timestamp")

        console.log("Headers:", {
            svix_id: request.headers.get("svix-id"),
            svix_signature: request.headers.get("svix-signature"),
            svix_timestamp: request.headers.get("svix-timestamp"),
          });
          

        if (!svix_id || !svix_signature || !svix_timestamp){
            console.error("Missing Svix headers");
            return new Response("Error occurred -- on svix headers", {
                status: 400,
            });
        }

        const payload = await request.json()
        console.log("Payload received:", payload);
        const body = JSON.stringify(payload)

        const wh = new Webhook(webhookSecret)
        let evt:WebhookEvent

        try {
            evt = wh.verify(body, {
                "svix-id": svix_id,
                "svix-signature": svix_signature,
                "svix-timestamp": svix_timestamp,
            }) as WebhookEvent
        } catch (err) {
            console.error("Error verifying webhook:", err);
            return new Response("Error occured", {status: 400})
        }

        const eventType = evt.type;
        if (eventType === "user.created") {
            const {id, email_addresses, first_name, last_name} = evt.data;

            const email = email_addresses[0].email_address;
            const name = `${first_name || ""} ${last_name || ""}`.trim();

            try {
                await ctx.runMutation(api.users.syncUser, {
                    userId: id,
                    email,
                    name,
                })
            } catch (error) {
                console.log("Error creating user:", error);
                return new Response("Error creating user", {status: 500})
            }
        }
        return new Response("Webhook processed successfully", {status: 200})
    })
})

export default http