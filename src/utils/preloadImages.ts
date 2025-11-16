// Preload all images used in the application for instant display

const IMAGES_TO_PRELOAD = [
  // Creature images
  '/creature_transparent.png',
  '/rose_trans.png',
  '/Slime_fixed.webp',
  // Shocked creature images
  '/creature_shocked_transparent.png',
  '/slime1_shockeda.png',
  // Anode images
  '/anode_cart.png',
  // Background images
  '/jug_cartoon1.png',
];

/**
 * Preloads all images by creating Image objects and setting their src.
 * This causes the browser to fetch and cache them, making them instantly
 * available when needed.
 */
export function preloadAllImages(): Promise<void> {
  const loadPromises = IMAGES_TO_PRELOAD.map((src) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => {
        console.warn(`Failed to preload image: ${src}`);
        resolve(); // Don't fail the whole preload if one image fails
      };
      img.src = src;
    });
  });

  return Promise.all(loadPromises).then(() => {
    console.log('All images preloaded successfully');
  });
}

