import Link from 'next/link'

export default function Page() {
  return (
    <div>
      <p>hello nextjs</p>
      <Link href="/">
        <a>home</a>
      </Link>
    </div>
  )
}

export const config = { runtime: 'experimental-edge' }
