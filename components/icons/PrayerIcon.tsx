import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

export const PrayerIcon: React.FC<IconProps> = ({ color, size = 24 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Top Roof of Kaaba */}
      <Path
        d="M12 4L20 8L12 12L4 8L12 4Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Left and Right Wall Outline */}
      <Path
        d="M4 8V18L12 22M20 8V18L12 22"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Central Corner Line */}
      <Path
        d="M12 12V22"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Kiswa Golden Belt (Horizontal Band) */}
      <Path
        d="M4 11L12 15M12 15L20 11"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Golden Door (Bab al-Kaaba) on the Right Wall */}
      <Path
        d="M14 19V15L18 13V17L14 19Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default PrayerIcon;
