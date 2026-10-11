// Original spoken adaptations. Research mapping: docs/network-engineer-interview.md.
function scope(entries) {
  return { topicScope: entries.map(([topic]) => topic), topicKeywords: entries.map(([, keywords]) => keywords) };
}
function applied(base, descriptions) {
  return { ...base, topicScope: base.topicScope.map((topic, i) => `${topic.split(':')[0]}: ${descriptions[i]}`) };
}
const easy = scope([
  ['Network devices', ['switch', 'router', 'device', 'access point']],
  ['Addressing basics', ['IP address', 'MAC address', 'gateway', 'addressing']],
  ['Name and configuration services', ['DNS', 'DHCP', 'hostname', 'lease']],
  ['Transport basics', ['TCP', 'UDP', 'transport', 'port number']],
  ['Wireless connections', ['wireless', 'Wi-Fi', 'signal', 'SSID']],
  ['Troubleshooting observations', ['cable', 'link indicator', 'symptom', 'troubleshooting']],
]);
const medium = scope([
  ['Subnet forwarding', ['subnet', 'prefix', 'gateway', 'forwarding']],
  ['VLAN switching', ['VLAN', 'trunk', 'access port', 'broadcast domain']],
  ['Service diagnosis', ['DNS', 'DHCP', 'resolver', 'lease']],
  ['Transport behavior', ['TCP', 'UDP', 'retransmission', 'ordering']],
  ['Access rules and translation', ['ACL', 'NAT', 'translation', 'access rule']],
  ['Link performance', ['duplex', 'interface error', 'bandwidth', 'latency']],
]);
const hard = scope([
  ['Route selection and return paths', ['route', 'routing', 'return path', 'prefix match']],
  ['Loop prevention', ['spanning tree', 'loop', 'redundant link', 'broadcast storm']],
  ['DHCP relay and allocation', ['DHCP', 'relay', 'pool', 'lease']],
  ['Stateful paths and policy', ['stateful', 'firewall', 'NAT', 'asymmetric']],
  ['Transport evidence and packet size', ['MTU', 'TCP', 'packet size', 'ICMP']],
  ['Operational assurance', ['failover', 'change', 'wireless', 'baseline']],
]);
const easyExamples = {
  focus_clarity: [
    'What is a switch used for in a local network?',
    'What is an IP address used for on a network?',
    'What is DNS used for when opening a website by hostname?',
    'What is a transport port number used to identify?',
    'What is a wireless network name used for?',
    'What does a cable link indicator help a student observe?',
  ],
  focus_correctness: [
    'How does a switch differ from a router in forwarding network traffic?',
    'How does an IP address differ from a MAC address?',
    'How does DNS differ from DHCP?',
    'How does TCP delivery differ from UDP delivery?',
    'Which wireless setting identifies the Wi-Fi network a student wants to join?',
    'An Ethernet cable is unplugged; what happens to that wired link?',
  ],
  focus_completeness: [
    'Name two familiar network devices?',
    'Name two addressing details used for reaching a remote network?',
    'Name two network settings a DHCP server can provide?',
    'Name two familiar transport protocols?',
    'Name two details needed to join a protected wireless network?',
    'Name two physical observations useful in troubleshooting a disconnected cable?',
  ],
};
const mediumExamples = {
  focus_clarity: [
    'How does a subnet prefix help a host decide whether to use its gateway?',
    'Why does a VLAN separate a broadcast domain on a switch?',
    'Why can a DNS resolver problem prevent hostname access while direct address access still works?',
    'How does TCP retransmission help recover missing data?',
    'Why does NAT address translation need a separate access policy to decide permitted traffic?',
    'Why can a duplex mismatch increase errors on an Ethernet link?',
  ],
  focus_correctness: [
    'A destination is outside the host subnet and a reachable gateway is configured; where does the host send the packet first?',
    'How does a VLAN access port differ from a trunk carrying several VLANs?',
    'How does a DHCP lease differ from a DNS record?',
    'How does TCP ordering differ from UDP datagram delivery?',
    'An ACL explicitly denies matching traffic; what happens to a packet that matches that access rule?',
    'How does bandwidth differ from latency when describing link performance?',
  ],
  focus_completeness: [
    'Name two host settings to inspect when subnet forwarding sends traffic to the wrong gateway?',
    'Name two VLAN settings to inspect when an expected trunk cannot carry student traffic?',
    'Name two DNS resolver checks for a hostname that does not resolve?',
    'Name two TCP behaviors that support reliable ordered delivery?',
    'Name two ACL packet details used to match an access rule?',
    'Name two interface observations useful when investigating a duplex mismatch?',
  ],
};
const hardExamples = {
  focus_clarity: [
    'Why does successful outbound routing still need a working return path for a reply?',
    'How does spanning tree prevent a forwarding loop while keeping a redundant link available?',
    'Why does a DHCP relay help a client reach a server outside its broadcast domain?',
    'Why can an asymmetric reply be dropped by a stateful firewall that never observed the outgoing connection?',
    'Why can blocked ICMP packet-size feedback prevent discovery of a smaller path MTU?',
    'Why does a failover test need application observations beyond a healthy standby indicator?',
  ],
  focus_correctness: [
    'Two installed routes match a destination and one has a longer prefix match; which route is selected?',
    'How does a spanning tree blocked redundant link differ from a failed physical link?',
    'A DHCP pool has no free addresses and no reusable lease; what allocation result should a new client expect?',
    'A stateful firewall requires known connection state but a reply crosses a different firewall without shared state; what happens to that reply?',
    'How does a path MTU limitation differ from packet loss caused by a congested TCP connection?',
    'How does a wireless signal strength measurement differ from evidence of successful application access?',
  ],
  focus_completeness: [
    'Name three routing observations needed to investigate a missing return path?',
    'Name three spanning tree observations useful when investigating a broadcast storm?',
    'Name three DHCP relay checks for clients that receive no lease from a remote server?',
    'Name three stateful firewall observations needed to investigate an asymmetric connection?',
    'Name three TCP packet observations useful when investigating a path MTU limitation?',
    'Name three change verification checks before accepting a network failover result?',
  ],
};
module.exports = {
  id: 'network-engineer', label: 'Network Engineer',
  avoidList: `NETWORK ENGINEER SCOPE:
- Use student labs, small networks and hypothetical authorized troubleshooting. Ask one original spoken task without vendor command recall, dotted IP literals, slash prefixes, subnet arithmetic worksheets or certification trivia.
- Prefer IP addressing, device purposes, DNS, DHCP, transport behavior, VLANs, routing and observable troubleshooting. OSI or TCP/IP layers may explain a mechanism; do not require reciting every layer or port number.
- State relevant topology, subnet membership, gateway reachability, VLAN membership, allowed trunk VLANs, installed routes and explicit policy when they determine the answer. A connected cable alone does not prove end-to-end connectivity.
- Specify a Layer 2 switch when contrasting switching with routing if needed. VLAN separation alone does not forbid communication when routing and policy permit it; a trunk carries allowed VLANs but does not route between them.
- DNS provides name resolution, DHCP provides client configuration, and ARP resolves local IPv4 next-hop link addresses. IPv6 uses Neighbor Discovery, not ARP or broadcast. A DHCP relay is needed only when the client must reach a server in another broadcast domain and no equivalent forwarding service exists.
- TCP provides an ordered reliable byte stream with retransmission; UDP has no built-in delivery or ordering guarantee. Never assert that UDP is always faster, every application using UDP is unreliable, or TCP guarantees eventual success under permanent failure.
- Routing selects the longest matching installed prefix before comparing preferences for equivalent prefixes. Supply active routes and usable next hops; no ambiguous equal-cost or missing-route assumptions. A successful outbound path does not prove a reply path exists.
- NAT translation does not itself establish authorization or encryption. State the access rule, direction, connection state and shared-state condition before predicting firewall outcomes; asymmetric routing is not always a failure.
- Ping failure alone does not prove a host is down, and ping success does not prove application health. Direct IP access only isolates DNS when testing the same service under stated hostname-independent conditions; avoid HTTPS virtual-host and certificate ambiguity.
- Wireless association, strong signal and a correct password do not prove DNS, IP configuration or application access. Bandwidth is capacity, latency is delay, throughput is observed rate; distinguish them and avoid universal wireless-channel advice.
- Spanning tree blocks selected forwarding paths to prevent Layer 2 loops; do not imply physical disconnection, immediate convergence or zero downtime. Broadcast loops require a stated Layer 2 cycle without effective loop prevention.
- For path MTU problems, state that small traffic works, larger traffic exceeds a downstream size limit and the relevant feedback is blocked; do not treat this as the only cause of every stalled transfer. IPv6 routers do not fragment forwarded packets.
- Set 1 clarity explains one purpose or mechanism; correctness requests one precise outcome or comparison; completeness asks two items in easy/medium and three in hard. Do not append tasks or leak list answers.
- Changes and failover questions must specify authorization, a baseline, verification evidence and rollback conditions when necessary. No production outages, entire enterprise designs, advanced BGP tuning or required professional experience.
- Avoid boilerplate such as in a small lab or in a student lab. Use the shortest necessary context, aim for 18 to 30 words even in hard questions, and prefer a general mechanism question when a scenario adds no useful condition.
- For NAT replies, distinguish unsolicited incoming connections from replies to an outgoing connection. Absence of a new incoming rule does not prove an outgoing connection reply is blocked. Supply the translation entry and explicit return-traffic policy if asking for a reply outcome.
- Never ask which route wins using only static versus dynamic or reachable versus unreachable labels. Prefer two installed usable routes with different matching prefix lengths; route preference ties need an explicit selection rule.
- For a DHCP relay with an incorrect client-subnet indication, specify the server has no matching allocation scope before predicting failure; the generic phrase wrong gateway address cannot determine the server outcome.
- Do not infer a DNS failure merely from successful public ping and failed website access. When isolating DNS, explicitly state a failed lookup and successful access to the same hostname-independent service by address.
- A link light color has no universal meaning without the device legend. Ask whether the physical link is detected without assuming green, amber or blinking means one standardized state.
- In medium Set 1 clarity, ask How or Why for the mechanism rather than What does this suggest or Which mechanism is used. In easy Set 1 correctness, ask a fact or comparison rather than Why, diagnosis or a cause inferred from incomplete symptoms.
- A UDP application may implement recovery. When predicting a lost UDP datagram outcome, explicitly exclude application retries or recovery; do not assume a video call necessarily has none.
- A reply entering a different interface on the same firewall does not by itself imply missing connection state or a drop. Use a second firewall explicitly requiring state it does not have. A reply bypassing the firewall cannot be dropped by that bypassed firewall.
- Do not infer withdrawal of an installed route merely because its next hop is unusable; state that the route is withdrawn if comparing fallback behavior. Prefer longest-prefix examples with both next hops usable.
- Failure of an already blocked link does not restore connectivity. For failover, specify failure of the active forwarding link and a usable alternate that can converge.
- Channel overlap alone does not guarantee a specific throughput or latency change. Ask about measured interference or compare baseline service observations; do not predict an exact or inevitable performance outcome from the channel label alone.`,
  difficultyAvoidLists: {
    easy: 'Use one familiar purpose, simple distinction or one-step observation. No subnet calculation, packet analysis, relay troubleshooting, routing selection, VLAN internals or advanced diagnosis.',
    medium: 'Use one applied mechanism, check or outcome with at most two reasoning steps. No DHCP relay or pool exhaustion tasks, routing protocol internals, convergence analysis, packet-size black holes, asymmetric stateful paths or enterprise design.',
    hard: 'Use one bounded advanced-junior conditional outcome, evidence limit or trade-off. Supply necessary route, state, relay, loop and packet-size conditions; no full incident plans, vendor syntax or senior network architecture.',
  },
  set1: {
    ...medium,
    difficultyTopics: {
      easy: { ...easy, focusTopics: { focus_completeness: applied(easy, [
        'name two familiar devices', 'name two familiar host addressing details', 'name two supplied client settings',
        'name two familiar transport protocols', 'name two protected wireless joining details', 'name two physical cable observations',
      ]) } },
      medium: { ...medium, focusTopics: { focus_completeness: applied(medium, [
        'name two host forwarding settings', 'name two VLAN trunk settings', 'name two name resolution checks',
        'name two reliable transport behaviors', 'name two policy matching details', 'name two Ethernet interface observations',
      ]) } },
      hard: { ...hard, focusTopics: { focus_completeness: applied(hard, [
        'name three return-path observations', 'name three loop-prevention observations', 'name three remote allocation checks',
        'name three connection-state path observations', 'name three size-limited transfer observations', 'name three failover verification checks',
      ]) } },
    },
    easyExamples, mediumExamples, hardExamples,
  },
  set2: {
    ...medium,
    difficultyTopics: {
      easy: applied(easy, [
        'explain a familiar device purpose or choose a device for a small network',
        'distinguish familiar addresses or choose a configured next hop for a remote network',
        'select name resolution or automatic configuration for a stated need',
        'compare transport delivery properties for a familiar application need',
        'choose the intended wireless network or check basic joining details',
        'observe a cable or link indicator before changing configuration',
      ]),
      medium: applied(medium, [
        'predict local or gateway forwarding under an explicit subnet condition',
        'apply a stated VLAN access or allowed trunk rule',
        'isolate a resolver or lease condition using stated observations',
        'apply retransmission and ordering to a stated delivery need',
        'apply an explicit access rule or separate address translation from permission',
        'interpret bounded interface errors or distinguish capacity from observed delay',
      ]),
      hard: applied(hard, [
        'choose a longest installed prefix or check one missing reply path',
        'predict a redundant Layer 2 path outcome with stated spanning tree behavior',
        'check remote relay delivery or predict allocation with no available addresses',
        'predict an asymmetric reply under an explicit connection-state rule',
        'evaluate size-limited TCP evidence under a stated downstream MTU and feedback condition',
        'verify one approved failover or wireless change against baseline service observations',
      ]),
    },
    easyExamples: [
      'What does a router do between local networks?',
      'Why does a host need a gateway to reach a remote network?',
      'How does DNS differ from DHCP when preparing a laptop for network use?',
      'A sender uses UDP without application retries; what happens to a datagram lost in transit?',
      'Name two checks for whether a laptop selected the intended wireless network?',
      'A wired cable is unplugged from a laptop; what physical action restores that connection?',
    ],
    mediumExamples: [
      'How does a subnet prefix influence the choice between direct delivery and a gateway?',
      'Why does a VLAN trunk need to allow the VLAN carrying student traffic?',
      'How does a DNS resolution failure differ from a DHCP lease allocation failure?',
      'A TCP segment is lost and the connection remains usable; what happens to the missing data through retransmission?',
      'Name two checks for whether an ACL denies the intended traffic?',
      'A wired link reports interface errors and inconsistent duplex settings; what link setting should you inspect?',
      'A host reaches the same hostname-independent service by address but DNS lookup fails; what resolver setting should you check first?',
      'Why would you prefer verifying observed latency over assuming advertised bandwidth proves a responsive link?',
    ],
    hardExamples: [
      'How does longest prefix matching choose between two installed routes to the same destination?',
      'Why does spanning tree keep a redundant link blocked while another forwarding path exists?',
      'How does a DHCP relay differ from a DHCP server when allocating a remote client lease?',
      'A stateful firewall requires existing connection state and an asymmetric reply lacks that state; what happens to the reply?',
      'Name two checks for whether TCP traffic exceeds a downstream MTU when small packets succeed?',
      'An approved failover restores basic reachability; what application observation should verify that the student service recovered?',
      'A DHCP server is outside the client broadcast domain and receives no discovery message; what relay forwarding condition should you check first?',
      'Why would you prefer baseline service tests over signal strength alone when verifying an approved wireless change?',
    ],
  },
};
