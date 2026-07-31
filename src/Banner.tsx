import banner from './assets/banner.png'

/** Brand banner pinned to the top of every screen. */
export default function Banner() {
  return (
    <div className="brand-banner">
      <img src={banner} alt="40 let" />
    </div>
  )
}
