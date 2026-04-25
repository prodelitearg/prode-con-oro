import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Banner {
  id: string;
  image_url: string;
  link_url: string | null;
  title: string | null;
}

interface Props {
  intervalMs?: number;
}

export function BannerCarousel({ intervalMs = 3000 }: Props) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("ads_banners" as never)
        .select("id,image_url,link_url,title")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      setBanners((data ?? []) as Banner[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % banners.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [banners.length, intervalMs]);

  if (loading || banners.length === 0) return null;

  return (
    <div className="banner-carousel">
      <div
        className="banner-track"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {banners.map((b) => {
          const content = (
            <img
              src={b.image_url}
              alt={b.title ?? "Publicidad"}
              className="banner-img"
              loading="lazy"
            />
          );
          return (
            <div key={b.id} className="banner-slide">
              {b.link_url ? (
                <a href={b.link_url} target="_blank" rel="noopener noreferrer">
                  {content}
                </a>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div className="banner-dots" role="tablist" aria-label="Selector de publicidad">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir al banner ${i + 1}`}
              className={`banner-dot ${i === idx ? "is-active" : ""}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}