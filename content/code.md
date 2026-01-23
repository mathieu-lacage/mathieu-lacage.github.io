+++
title = "Code"
toc = true
toclevels = 1
+++

## Bake

[Code](https://gitlab.com/nsnam/bake) [Documentation](https://www.nsnam.org/docs/bake/tutorial/html/index.html)

Bake is a build tool which is similar in scope 
to jhbuild. Its distinctive feature is to provide more flexibility than other similar
tools in setting up a specific build. It uses XML-based metadata about a set of 
software packages to automate the process of downloading, and building in the 
right order a selected subset of these packages. Bake is written is python. I
originally designed it to replace the ns-3 build system and to provide
an integration framework for the many ns-3 simulation modules maintained
by third-parties.

## Virtualization ELF loader

[Code](https://gitlab.com/nsnam/elf-loader)

I originally implemented VDL 
to virtualize global and static variables for the ns-3 DCE module. Later on, I added simpler virtualization techniques
to ns-3 to avoid the complexity of maintaining this project but VDL is still the most efficient
(cpu and memory wise, by an order of magnitude) way to virtualize applications within ns-3.</p>

This loader is source and binary compatible with the GNU ELF loader which
ships with the glibc library used in most Linux distributions.

## ns-3 DCE module

[Code](https://github.com/direct-code-execution/ns-3-dce/)
[Documentation](https://www.nsnam.org/about/projects/direct-code-execution/)

I implemented this ns-3 model as part of my Ph.D. thesis.
DCE is a framework for 
ns-3 that provides facilities to execute, within ns-3, existing implementations 
of userspace and kernelspace network protocols or applications without source 
code changes.
 
## ns-3

[Code](https://gitlab.com/nsnam/ns-3-dev) [Documentation](https://www.nsnam.org/documentation/)

[ns-3](http://www.nsnam.org) is a discrete-time event-driven network simulator 
which is slowly replacing ns2 as the reference network simulator for networking research. 
While they share the same name, these two projects are in fact entirely different codebases. 
I served as software lead for ns-3 so, if you feel it sucks, it is probably my fault. I
worked a lot on the simulation core: event management, packet structure,
and I ported to ns-3 the wifi models I originally wrote for YANS.

## YANS

[Code](https://github.com/mathieu-lacage/yans)

A couple of years ago, I was fed up  with the many architectural flaws of ns2 which
made it hard to develop new simulation modules so I built Yans
(Yet Another Network Simulator), a prototype network simulator 
to demonstrate how I felt it could be done better.  A lot of ideas and concepts originally
implemented within Yans were later integrated in ns-3.

## The Bozo Profiler

[Code](https://github.com/mathieu-lacage/bozo-profiler)

The bozo-profiler is not really a profiler. It is more a library to 
perform in-process debugging and code path analysis.

It can be used to get a dump of the runtime call graph of any program
for which you have the source code. It requires a complete recompilation of your code
and generates a set of binary dump files which represent the program call graph.
Right now, this profiler has been successfully used with various applications 
such as: nautilus, mozilla, open office, eog, and gimp.

These binary dumps can then be converted to human-readable text files. For now,
the most interesting output file format you can select is the so-called _dot_
format which can be used as input to 
[graphviz](http://www.graphviz.org/) to generate nice-looking
pdf org png representations of the call graphs.

