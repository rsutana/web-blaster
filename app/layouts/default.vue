<template>
  <div class="flex min-h-screen flex-wrap items-stretch bg-[#F2F3F5] font-sans text-[#0B0B0C] min-[901px]:flex-nowrap">
    <LayoutAppSidebar />
    <main class="bpa-main flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-8 pt-8 pb-12 max-[900px]:px-4 max-[900px]:pt-5 max-[900px]:pb-10">
      <slot />
    </main>
  </div>
</template>
