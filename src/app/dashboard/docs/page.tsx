import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

function Code({ children }: { children: string }) {
  return (
    <pre className="rounded-lg border bg-muted/40 p-3 overflow-x-auto text-xs font-mono leading-relaxed">
      {children}
    </pre>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardContent className="pt-6 space-y-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">{children}</div>
      </CardContent>
    </Card>
  )
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 pl-3 py-0.5 space-y-1">
      <p className="text-sm font-medium text-foreground">{q}</p>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

const SECTIONS = [
  ['what-is-this', 'What this is'],
  ['add-registry', 'Connect a registry'],
  ['push', 'Push an image'],
  ['browse', 'Browse images and tags'],
  ['manifests', 'Manifest types and multi-arch'],
  ['roles', 'Roles and permissions'],
  ['delete', 'Deleting tags'],
  ['retention', 'Automatic cleanup'],
  ['upgrade', 'Updating Registry UI'],
  ['faq', 'FAQ'],
]

// Examples always use a placeholder host, never a configured registry.
const host = 'registry.example.com'

export default function DocsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Manual</h1>
        <p className="text-sm text-muted-foreground mt-1">
          How Registry UI works, how to push images, and answers to the usual questions.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="text-xs px-2.5 py-1 rounded-md border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {label}
          </a>
        ))}
      </div>

      <Section id="what-is-this" title="What this is">
        <p>
          Registry UI is a web front end for one or more <span className="font-mono text-foreground">Docker Registry v2</span>{' '}
          endpoints. It reads images, tags, manifests and image configuration straight from the registry
          API — nothing is mirrored or cached.
        </p>
        <p>
          Its own SQLite database only holds three things: the user accounts that can log in, the
          registry connections (URL and credentials), and the log of deleted tags. Deleting the
          database never touches your images.
        </p>
      </Section>

      <Section id="add-registry" title="Connect a registry">
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Sign in as an admin, then open <span className="text-foreground">Admin → Registries</span>.</li>
          <li><span className="text-foreground">Add Registry</span> — give it a name, the base URL (for example <span className="font-mono">https://{host}</span>), and credentials if the registry requires auth.</li>
          <li>Pick an environment label: production, staging or local. It only affects the badge colour.</li>
          <li>Hit <span className="text-foreground">Test connection</span> before saving — it calls the catalog endpoint and reports how many images it found.</li>
        </ol>
        <p>
          Both HTTP Basic and Bearer-token (registry auth server) flows are supported. A registry that
          answers <span className="font-mono">/v2/</span> works.
        </p>
      </Section>

      <Section id="push" title="Push an image">
        <p>Log in once per registry host:</p>
        <Code>{`docker login ${host}`}</Code>
        <p>Build and tag with the registry host as the first path segment, then push:</p>
        <Code>{`docker build -t ${host}/myapp:1.0.0 .
docker push ${host}/myapp:1.0.0`}</Code>
        <p>Tagging an existing local image works the same way:</p>
        <Code>{`docker tag myapp:1.0.0 ${host}/myapp:1.0.0
docker push ${host}/myapp:1.0.0`}</Code>
        <p>
          The convention is to push a version tag <em>and</em> move <span className="font-mono">latest</span>:
        </p>
        <Code>{`docker tag ${host}/myapp:1.0.0 ${host}/myapp:latest
docker push ${host}/myapp:latest`}</Code>
        <p>
          Both tags then point at the same digest — deleting one deletes the other, because a registry
          deletes manifests, not tag names.
        </p>
        <p>
          If the registry is served over plain HTTP, every client machine needs it listed as an
          insecure registry in <span className="font-mono">/etc/docker/daemon.json</span>, followed by a Docker restart:
        </p>
        <Code>{`{ "insecure-registries": ["${host}"] }`}</Code>
      </Section>

      <Section id="browse" title="Browse images and tags">
        <p>
          <span className="text-foreground">Dashboard</span> lists every connected registry with its
          image count. Open a registry to see its repositories, then an image to see its tags.
        </p>
        <p>
          Tags can be sorted by created date, name or size. <span className="font-mono">latest</span> is
          always pinned to the top when sorting by date. Each row shows the digest, compressed size and
          layer count; the detail drawer adds architecture, OS, environment variables, entrypoint,
          labels and the build history.
        </p>
      </Section>

      <Section id="manifests" title="Manifest types and multi-arch">
        <p>
          The small grey label under a digest is the tail of the tag’s manifest media type. Both
          formats a registry can hand out are supported:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <span className="font-mono text-foreground">v2+json</span> —{' '}
            <span className="font-mono">docker.distribution.manifest.v2+json</span>, a single image:
            one config blob plus its layers. Size and layer count come straight off it.
          </li>
          <li>
            <span className="font-mono text-foreground">v1+json</span> —{' '}
            <span className="font-mono">oci.image.index.v1+json</span> (or Docker’s{' '}
            <span className="font-mono">manifest.list.v2+json</span>), an <em>index</em>: a list
            pointing at one manifest per platform. It carries no layers of its own, which is why an
            index used to show a blank size and no details.
          </li>
        </ul>
        <p>
          For an index, Registry UI now follows the list and reads one child manifest —{' '}
          <span className="font-mono">linux/amd64</span> when the index has it, otherwise the first
          real platform. Size, layer count, created date, environment, labels and build history all
          come from that child; the tag keeps the index digest, so deleting still removes the whole
          index. Every platform in the index is listed in the detail drawer.
        </p>
        <p>
          Attestation entries that <span className="font-mono">docker buildx</span> adds (platform{' '}
          <span className="font-mono">unknown/unknown</span>) are ignored — they are signatures and
          SBOMs, not runnable images.
        </p>
        <p>
          A multi-arch index is what you get from <span className="font-mono">docker buildx</span>;
          a plain <span className="font-mono">docker build</span> push produces the single-image
          form:
        </p>
        <Code>{`docker buildx build --platform linux/amd64,linux/arm64 \\
  -t ${host}/myapp:1.0.0 --push .`}</Code>
      </Section>

      <Section id="roles" title="Roles and permissions">
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="shrink-0 font-mono text-[10px]">viewer</Badge>
            <span>Browse registries, images, tags and the deleted-tags log. No changes of any kind.</span>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="shrink-0 font-mono text-[10px]">admin</Badge>
            <span>Everything a viewer can do, plus: add, edit and remove registry connections, manage users, delete tags, and configure or run tag cleanup.</span>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="shrink-0 font-mono text-[10px]">super_admin</Badge>
            <span>Everything an admin can do. The first account, seeded from <span className="font-mono">ADMIN_USERNAME</span> / <span className="font-mono">ADMIN_PASSWORD</span> on first boot, and it cannot be removed.</span>
          </div>
        </div>
      </Section>

      <Section id="delete" title="Deleting tags">
        <p>
          Admins get a trash icon on every tag row. For several tags at once, hover a row — its tag icon
          turns into a checkbox. Ticking one enters selection mode: every checkbox stays visible and a
          toolbar appears above the list with <span className="text-foreground">Select all</span>, the
          selected count, <span className="text-foreground">Clear</span>, and{' '}
          <span className="text-foreground">Copy</span> / <span className="text-foreground">Delete</span>.
          Copy puts the full <span className="font-mono">{host}/image:tag</span> reference of every
          selected tag on the clipboard, one per line. Clearing the last selection leaves selection mode.
          Every deletion is written to the <span className="text-foreground">Deleted</span> page with who
          did it and when.
        </p>
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-xs">
            Deletion needs to be enabled on the registry itself. Without it every delete fails with{' '}
            <span className="font-mono">Delete not enabled on registry</span>.
          </span>
        </div>
        <p>Docker Compose:</p>
        <Code>{`services:
  registry:
    image: registry:2
    environment:
      REGISTRY_STORAGE_DELETE_ENABLED: "true"`}</Code>
        <p>Or in <span className="font-mono">config.yml</span>:</p>
        <Code>{`storage:
  delete:
    enabled: true`}</Code>
        <p>
          Deleting a tag removes the manifest immediately, but the layer blobs stay on disk until the
          registry garbage-collects them:
        </p>
        <Code>{`docker exec -it registry bin/registry garbage-collect /etc/docker/registry/config.yml`}</Code>
      </Section>

      <Section id="retention" title="Automatic cleanup">
        <p>
          Each registry can keep only its newest N tags per image. Set it in{' '}
          <span className="text-foreground">Admin → Registries → Edit</span>:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><span className="text-foreground">Keep last N tags</span> — how many tags of every image survive, newest build date first. <span className="font-mono">0</span> turns cleanup off (the default).</li>
          <li><span className="text-foreground">Protected tags</span> — comma-separated patterns that are never deleted, <span className="font-mono">*</span> being the wildcard: <span className="font-mono">latest, v*, prod-*</span>. <span className="font-mono">latest</span> is always protected whether it is listed or not.</li>
        </ul>
        <p>
          The sweep runs in the background every <span className="font-mono">RETENTION_INTERVAL_HOURS</span>{' '}
          hours (24 by default), never at start-up. Set <span className="font-mono">RETENTION_AUTO=false</span>{' '}
          to disable the timer entirely and rely on the timer icon next to each registry, which runs the
          same sweep on demand. Everything it removes lands on the{' '}
          <span className="text-foreground">Deleted</span> page marked <span className="font-mono">auto</span>.
        </p>
      </Section>

      <Section id="upgrade" title="Updating Registry UI">
        <p>
          Registry UI ships as <span className="font-mono">byteoath/registry-ui</span>. Pulling a
          newer image is safe: users, registry connections and the deleted-tags log live in the
          SQLite file on the <span className="font-mono">/data</span> volume, not in the image.
        </p>
        <p>Docker Compose — pull, recreate, done:</p>
        <Code>{`docker compose pull
docker compose up -d`}</Code>
        <p>
          Plain <span className="font-mono">docker run</span> — pull the new image, drop the old
          container, start it again with the same volume and environment:
        </p>
        <Code>{`docker pull byteoath/registry-ui:latest
docker stop registry-ui && docker rm registry-ui
docker run -d --name registry-ui \\
  -p 3000:3000 \\
  -v registry-ui-data:/data \\
  -e ADMIN_USERNAME=admin \\
  -e ADMIN_PASSWORD=changeme \\
  -e APP_SECRET=your-random-secret-here \\
  byteoath/registry-ui:latest`}</Code>
        <p>
          To pin a version instead of tracking <span className="font-mono">latest</span>, swap the
          tag — <span className="font-mono">byteoath/registry-ui:1.2.0</span> — and bump it when you
          choose to. Check what is running with:
        </p>
        <Code>{`docker inspect --format '{{index .Config.Image}}' registry-ui`}</Code>
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-xs">
            Keep the <span className="font-mono">/data</span> volume and the same{' '}
            <span className="font-mono">APP_SECRET</span> across upgrades. Losing the volume loses
            your accounts and registry connections; changing the secret signs everyone out.
          </span>
        </div>
      </Section>

      <Section id="faq" title="FAQ">
        <div className="space-y-4">
          <Faq q="Delete fails with “Delete not enabled on registry”.">
            <p>
              The registry rejects DELETE requests until you start it with{' '}
              <span className="font-mono">REGISTRY_STORAGE_DELETE_ENABLED=true</span> (or{' '}
              <span className="font-mono">storage.delete.enabled: true</span> in{' '}
              <span className="font-mono">config.yml</span>). Restart the registry after changing it.
            </p>
          </Faq>

          <Faq q="I deleted tags but the disk did not shrink.">
            <p>
              Expected. Deleting removes the manifest; the blobs are only freed by the registry
              garbage collector, which needs to run separately — and the registry should be in
              read-only mode or stopped while it does.
            </p>
          </Faq>

          <Faq q="Can I restore a deleted tag?">
            <p>
              No. The Deleted page is an audit log, not a recycle bin. Push the image again to bring
              the tag back.
            </p>
          </Faq>

          <Faq q="I deleted one tag and another disappeared too.">
            <p>
              Those tags shared a digest — usually <span className="font-mono">1.0.0</span> and{' '}
              <span className="font-mono">latest</span> pointing at the same build. Registries delete
              manifests by digest, so every tag on that digest goes at once.
            </p>
          </Faq>

          <Faq q="The image list is empty or shows a registry error.">
            <p>
              Check the URL (base URL, no <span className="font-mono">/v2</span> suffix), the
              credentials, and that the host is reachable from the container running Registry UI.
              Use <span className="text-foreground">Test connection</span> on the registry form —
              it reports auth failures separately from unreachable hosts.
            </p>
          </Faq>

          <Faq q="Who is allowed to delete?">
            <p>
              Only <span className="font-mono">admin</span> and <span className="font-mono">super_admin</span>.
              Viewers do not see the checkboxes or the delete buttons, and the API rejects them too.
            </p>
          </Faq>

          <Faq q="Where is the data stored?">
            <p>
              A single SQLite file at <span className="font-mono">DB_PATH</span> — by default{' '}
              <span className="font-mono">/data/registry-ui.db</span> in production. Mount a volume at{' '}
              <span className="font-mono">/data</span> or every restart resets your users and registries.
            </p>
          </Faq>

          <Faq q="I forgot the admin password.">
            <p>
              Set <span className="font-mono">ADMIN_PASSWORD</span> and restart the container — the
              super_admin password is re-synced from that variable on boot.
            </p>
          </Faq>

          <Faq q="Does Registry UI store my registry credentials?">
            <p>
              Yes, in its SQLite database, so it can talk to the registry on your behalf. Treat the
              database file as a secret and keep the volume private.
            </p>
          </Faq>
        </div>
      </Section>
    </div>
  )
}
