import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

export const PrayerIcon: React.FC<IconProps> = ({ color, size = 24 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Top Face of Kaaba */}
      <Path
        d="M12 3L20 7L12 11L4 7L12 3Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Left and Right Wall Outer Contours */}
      <Path
        d="M4 7V17L12 21M20 7V17L12 21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Central Division line of the Kaaba Corner */}
      <Path
        d="M12 11V21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Golden Kiswa Belt line around the Kaaba */}
      <Path
        d="M4 10L12 14M12 14L20 10"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The golden door of Kaaba (Bab al-Kaaba) on the right-hand wall */}
      <Path
        d="M14 17V14L17 12.5V15.5L14 17Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default PrayerIcon;
