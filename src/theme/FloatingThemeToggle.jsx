import ThemeToggle from './ThemeToggle'

// For pages without the Navbar (About, Application Process, Meet Sera): the
// same small pill as the header, top-right. top-[62px] clears the fixed
// AnnouncementBar (~45–49px) and centres the 28px pill on the "← Back" pills.
function FloatingThemeToggle() {
  return (
    <div className="fixed top-[62px] right-6 z-50 flex">
      <ThemeToggle variant="compact" />
    </div>
  )
}

export default FloatingThemeToggle
