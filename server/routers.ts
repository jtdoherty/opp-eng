import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { opportunities } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  opportunities: router({
    list: publicProcedure
      .input(z.object({
        type: z.enum(['tutoring', 'internship', 'volunteer', 'research', 'competition']).optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        let query = db.select().from(opportunities);
        
        if (input?.type) {
          query = query.where(eq(opportunities.type, input.type)) as any;
        }
        
        const results = await query.orderBy(desc(opportunities.createdAt)).limit(50);
        return results;
      }),
    
    create: protectedProcedure
      .input(z.object({
        type: z.enum(['tutoring', 'internship', 'volunteer', 'research', 'competition']),
        title: z.string().min(1),
        description: z.string().min(1),
        location: z.string().optional(),
        remote: z.boolean().optional(),
        skills: z.array(z.string()).optional(),
        contactEmail: z.string().email().optional(),
        contactNostr: z.string().optional(),
        contactTelegram: z.string().optional(),
        contactTwitter: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const result = await db.insert(opportunities).values({
          userId: ctx.user.id,
          type: input.type,
          title: input.title,
          description: input.description,
          location: input.location,
          remote: input.remote ? 1 : 0,
          skills: input.skills ? JSON.stringify(input.skills) : null,
          contactEmail: input.contactEmail,
          contactNostr: input.contactNostr,
          contactTelegram: input.contactTelegram,
          contactTwitter: input.contactTwitter,
        });
        
        return { success: true, id: result.insertId };
      }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
