import { redirect } from "next/navigation";

// /reviews sin slug redirige al índice
export default function ReviewsIndex() {
  redirect("/#reviews");
}
