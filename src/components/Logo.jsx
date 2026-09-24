import { useTheme } from '../theme/useTheme'
import logoDark from '../assets/logo.png'
import logoLight from '../assets/logo_light.jpeg'

// Dark theme: logo.png (520×354, transparent, logo inside a 27px margin).
// Light theme: logo_light.jpeg as supplied (1000×1000, white background, the
// same logo at 223,340 → 689,640). CSS frames the JPEG to the matching
// 520×354 window (x 196–716, y 313–667) so both themes render the logo at the
// same size and position, and multiply-blends it so the white background
// disappears into light surfaces. The image files themselves are untouched.
function Logo({ className = '' }) {
  const { isDark } = useTheme()

  return (
    <span className={`relative inline-block aspect-[520/354] overflow-hidden ${className}`}>
      {isDark ? (
        <img
          src={logoDark}
          alt="YZI Works"
          className="absolute inset-0 w-full h-full object-contain"
        />
      ) : (
        <img
          src={logoLight}
          alt="YZI Works"
          className="absolute max-w-none mix-blend-multiply"
          style={{
            width: `${(1000 / 520) * 100}%`,
            left: `${(-196 / 520) * 100}%`,
            top: `${(-313 / 354) * 100}%`,
          }}
        />
      )}
    </span>
  )
}

export default Logo
