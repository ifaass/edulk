import { createFileRoute, notFound } from "@tanstack/react-router";
import { LessonView } from "@/components/lesson-view";
import { getLesson } from "@/server/catalog";

export const Route = createFileRoute("/_app/lessons/$slug")({
  loader: async ({ params }) => {
    const lesson = await getLesson({ data: params.slug });
    if (!lesson) throw notFound();
    return lesson;
  },
  component: LessonPage,
});

function LessonPage() {
  const lesson = Route.useLoaderData();
  return <LessonView initial={lesson} />;
}
