export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export const tok = () => sessionStorage.getItem("token") ?? ""

export const ah = () => ({ Authorization: `Bearer ${tok()}` })

export const jsonH = () => ({ "Content-Type": "application/json", ...ah() })
