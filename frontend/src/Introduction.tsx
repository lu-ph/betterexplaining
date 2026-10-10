import { useEffect, useRef } from "react"

export default function Introduction() {
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual"
    }

    if (mainRef.current) {
      mainRef.current.scrollTop = 0
    }
  }, [])

  return (
    <main className="h-full overflow-y-auto bg-[#09090B] text-neutral-300 selection:bg-white/20 font-sans antialiased">
      <article className="mx-auto w-full max-w-[680px] px-6 py-16 sm:px-8 sm:py-24">
        <h1 className="mb-10 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          这个网页做什么？
        </h1>

        <div className="space-y-8 text-[18px] leading-[1.9] text-neutral-300/90">
          <p>
            AI 已经很强，用它学习也成了很多人的日常。但实际用下来，效果往往不如老师当面讲一遍。
          </p>

          <p>
            我观察到身边的一些情况是：把题目丢给 Gemini 或豆包，简单写几个字的提示词，AI 就吐出一大段的文字。他们盯着看半天还是似懂非懂，看困了，然后就跳过了，也懒得继续追问。
          </p>

          <p>
            AI 够聪明，学生也有理解力。问题多半出在方式上。
          </p>

          <p>
            和老师相比，没有特别设计的 AI 通常有这些不足：
          </p>

          <ul className="list-disc pl-5 space-y-1.5 marker:text-neutral-500">
            <li>几秒内把答案全部吐出来，节奏太快，跟不上</li>
            <li>文字全部堆在一起，读起来枯燥，重点也不突出</li>
            <li>直接给结论，缺少引导思考的过程</li>
            <li>不会反过来提问，无法根据反馈调整讲法</li>
          </ul>

          <p>
            所以做了这个网页，换一种交互方式，看看效果如何。
          </p>
        </div>
      </article>
    </main>
  )
}
