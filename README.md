# node-red-contrib-wappsto

Node-RED nodes that enable communication with [Wappsto](https://wappsto.com/).

## Requirements

You need a [Wappsto](https://wappsto.com/register) account and [Node-RED](https://nodered.org/docs/getting-started/installation), to install it globally type:

```
sudo npm install -g --unsafe-perm node-red
```

## Install

Install the Wappsto nodes by either:

* using the following command in your `~/.node-red` installation directory:

```
npm install node-red-contrib-wappsto
```

* or using Node-RED Install Pallet, look for "node-red-contrib-wappsto"

## Usage

This package comes with two nodes:

* **listener:** listens to stream events coming from Wappsto and outputs a message so that other wired nodes can act upon it.

* **writer:** sends data from other Node-RED nodes to Wappsto.

Behind the scenes, to enable the communication, the nodes will create a couple of data structures that are part of the [Unified Data Model](https://developer.wappsto.com/). The data can be accessed and managed using e.g. [My Data](https://store.wappsto.com/application/my_data) wapp.

In addition to providing the connectivity, this packages enables to run Node-RED flows in Wappsto. To upload the flows and make them running, it is enough to click the "Upload flows to Wappsto" button. To see and edit the exported files, go to [Wapp Creator](https://store.wappsto.com/application/wapp_creator).

## License

Apache 2.0 © [Seluxit A/S](http://seluxit.com)
