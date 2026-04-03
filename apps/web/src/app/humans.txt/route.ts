export async function GET() {
  const humansTxt = `
/* TEAM */
	Developer: LinkMine Team
	Contact: hello@linkmine.eliasrm.dev
	Location: Global

/* THANKS */
	Next.js - The React Framework
	Tailwind CSS - A utility-first CSS framework
	Lucide - Beautiful & consistent icon pack
	Prisma - Next-generation ORM

/* SITE */
	Last update: ${new Date().toISOString().split('T')[0]}
	Standards: HTML5, CSS3, JavaScript ES6+
	Components: React, TypeScript
	Software: VS Code, Git
	IDE: Visual Studio Code
`.trim()

  return new Response(humansTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    }
  })
}