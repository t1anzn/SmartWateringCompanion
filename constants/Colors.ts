/**
 * Smart Watering Companion Color Palette
 * A fresh, nature-inspired color scheme with greens and blues representing plants and water.
 */

const primaryGreen = '#2E7D32';    // Darker, more vibrant green
const darkGreen = '#1B5E20';       // Even darker green for accents/buttons
const lightGreen = '#81C784';      // Medium green for dark mode (not too light)
const waterBlue = '#2196F3';       // Water blue for hydration-related elements
const earthBrown = '#795548';      // Earth tones for soil representation
const foliageLight = '#81C784';    // Light foliage color

export const Colors = {
  light: {
    text: '#212121',
    background: '#fff',
    tint: primaryGreen,
    icon: darkGreen,
    tabIconDefault: '#687076',
    tabIconSelected: primaryGreen,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: lightGreen,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: lightGreen,
  },
};
